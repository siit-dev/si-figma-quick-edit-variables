import type {
  DiffCategory,
  DiffCodeScope,
  DiffValue,
  InstanceDiff,
  VisualStyleProperty,
} from './types'

export type CssGenerationInput = {
  instances: InstanceDiff[]
  activeCategories: Set<DiffCategory>
  scope: DiffCodeScope
}

export function generateDiffCss({
  instances,
  activeCategories,
  scope,
}: CssGenerationInput): string {
  const layers = instances.flatMap((instance) => instance.layers)
  if (layers.length === 0) return '/* No matching layers. */'
  const selectorCounts = countSelectors(layers.map((layer) => layer.nodeName))

  return layers
    .map((layer) => {
      const fields = new Set(layer.differences.map((difference) => difference.field))
      const categories = new Set(layer.differences.map((difference) => difference.category))
      const properties = layer.currentProperties.filter((property) =>
        includeProperty(property, scope, activeCategories, fields, categories),
      )
      const declarations = properties.flatMap((property) =>
        mapProperty(property, layer.nodeType),
      )
      const structural = layer.differences
        .filter((difference) => difference.category === 'structure')
        .map((difference) => `  /* ${difference.label}: ${difference.current.preview}. */`)
      const selectorBase = sanitizeIdentifier(layer.nodeName)
      const selector =
        selectorCounts.get(selectorBase)! > 1
          ? `${selectorBase}--${sanitizeIdentifier(layer.nodeId)}`
          : selectorBase
      const body = [...declarations, ...structural]
      return [
        `/* ${layer.nodePath.join(' / ')} */`,
        `.${selector} {`,
        ...(body.length ? body : ['  /* No safely mappable CSS properties. */']),
        '}',
      ].join('\n')
    })
    .join('\n\n')
}

function includeProperty(
  property: VisualStyleProperty,
  scope: DiffCodeScope,
  activeCategories: Set<DiffCategory>,
  fields: Set<string>,
  visibleCategories: Set<DiffCategory>,
): boolean {
  if (scope === 'full-layers') return true
  if (scope === 'matched-properties') return fields.has(property.field)
  if (activeCategories.size === 0) return true
  return activeCategories.has(property.category) && visibleCategories.has(property.category)
}

function mapProperty(property: VisualStyleProperty, nodeType: string): string[] {
  const value = parseDetail(property.value)
  const cssValue = tokenizedValue(property.value)
  const px = scalarWithUnit(property.value, 'px')
  const mappings: Record<string, () => string[]> = {
    visible: () => value === false ? declaration('display', 'none') : [],
    opacity: () => declaration('opacity', String(value)),
    blendMode: () => declaration('mix-blend-mode', kebab(String(value))),
    clipsContent: () => value === true ? declaration('overflow', 'hidden') : [],
    fills: () => mapPaints(value, nodeType === 'TEXT' ? 'color' : 'background-color', property.value),
    strokes: () => mapPaints(value, 'border-color', property.value, true),
    strokeWeight: () => declaration('border-width', px),
    strokeTopWeight: () => declaration('border-top-width', px),
    strokeRightWeight: () => declaration('border-right-width', px),
    strokeBottomWeight: () => declaration('border-bottom-width', px),
    strokeLeftWeight: () => declaration('border-left-width', px),
    strokeAlign: () => comment('Figma stroke alignment has no safe standard CSS equivalent'),
    dashPattern: () => comment('Figma dash patterns require border-specific interpretation'),
    cornerRadius: () => declaration('border-radius', px),
    topLeftRadius: () => declaration('border-top-left-radius', px),
    topRightRadius: () => declaration('border-top-right-radius', px),
    bottomLeftRadius: () => declaration('border-bottom-left-radius', px),
    bottomRightRadius: () => declaration('border-bottom-right-radius', px),
    effects: () => mapEffects(value),
    fontName: () => mapFont(value),
    fontSize: () => declaration('font-size', cssValue.includes('var(') ? cssValue : px),
    fontWeight: () => declaration('font-weight', cssValue),
    lineHeight: () => declaration('line-height', dimensionObject(value, property.value)),
    letterSpacing: () => declaration('letter-spacing', dimensionObject(value, property.value)),
    paragraphIndent: () => declaration('text-indent', px),
    paragraphSpacing: () => comment('Figma paragraph spacing is not emitted as element margin'),
    textCase: () => declaration('text-transform', textCase(value)),
    textDecoration: () => declaration('text-decoration', kebab(String(value))),
    textAlignHorizontal: () => declaration('text-align', kebab(String(value))),
    textAlignVertical: () => comment('Figma vertical text alignment depends on container layout'),
    paddingLeft: () => declaration('padding-left', px),
    paddingRight: () => declaration('padding-right', px),
    paddingTop: () => declaration('padding-top', px),
    paddingBottom: () => declaration('padding-bottom', px),
    itemSpacing: () => declaration('gap', px),
    counterAxisSpacing: () => declaration('row-gap', px),
    width: () => declaration('width', px),
    height: () => declaration('height', px),
    minWidth: () => declaration('min-width', px),
    maxWidth: () => declaration('max-width', px),
    minHeight: () => declaration('min-height', px),
    maxHeight: () => declaration('max-height', px),
    x: () => declaration('left', px),
    y: () => declaration('top', px),
    rotation: () => declaration('transform', `rotate(${scalarWithUnit(property.value, 'deg')})`),
    layoutMode: () => String(value) === 'NONE'
      ? []
      : [...declaration('display', 'flex'), ...declaration('flex-direction', String(value) === 'VERTICAL' ? 'column' : 'row')],
    layoutWrap: () => String(value) === 'WRAP' ? declaration('flex-wrap', 'wrap') : [],
    layoutPositioning: () => String(value) === 'ABSOLUTE' ? declaration('position', 'absolute') : [],
    layoutGrow: () => declaration('flex-grow', String(value)),
    primaryAxisAlignItems: () => declaration('justify-content', flexAlignment(value)),
    counterAxisAlignItems: () => declaration('align-items', flexAlignment(value)),
    layoutAlign: () => declaration('align-self', String(value) === 'STRETCH' ? 'stretch' : kebab(String(value))),
    primaryAxisSizingMode: () => comment('Figma primary-axis sizing is represented by emitted dimensions and flex rules'),
    counterAxisSizingMode: () => comment('Figma counter-axis sizing is represented by emitted dimensions and flex rules'),
  }
  return mappings[property.field]?.() ?? comment(`Unsupported Figma property: ${property.label}`)
}

function mapPaints(value: unknown, property: string, source: DiffValue, border = false): string[] {
  if (!Array.isArray(value) || value.length !== 1) {
    return comment('Multiple or unsupported Figma paints were omitted')
  }
  const paint = value[0] as Record<string, unknown>
  if (paint.type !== 'SOLID' || !paint.color) {
    return comment(`Unsupported ${String(paint.type ?? 'paint').toLowerCase()} paint was omitted`)
  }
  const lines = declaration(property, tokenizedValue(source))
  if (border) lines.push(...declaration('border-style', 'solid'))
  return lines
}

function mapEffects(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) return []
  const shadows: string[] = []
  const filters: string[] = []
  const backdrop: string[] = []
  const comments: string[] = []
  for (const item of value) {
    const effect = item as Record<string, any>
    if (effect.visible === false) continue
    if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
      const inset = effect.type === 'INNER_SHADOW' ? 'inset ' : ''
      shadows.push(`${inset}${effect.offset?.x ?? 0}px ${effect.offset?.y ?? 0}px ${effect.radius ?? 0}px ${effect.spread ?? 0}px ${color(effect.color)}`)
    } else if (effect.type === 'LAYER_BLUR') filters.push(`blur(${effect.radius ?? 0}px)`)
    else if (effect.type === 'BACKGROUND_BLUR') backdrop.push(`blur(${effect.radius ?? 0}px)`)
    else comments.push(...comment(`Unsupported Figma effect: ${String(effect.type)}`))
  }
  return [
    ...(shadows.length ? declaration('box-shadow', shadows.join(', ')) : []),
    ...(filters.length ? declaration('filter', filters.join(' ')) : []),
    ...(backdrop.length ? declaration('backdrop-filter', backdrop.join(' ')) : []),
    ...comments,
  ]
}

function mapFont(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return comment('Mixed font styles were omitted')
  }
  const font = value as Record<string, unknown>
  return [
    ...declaration('font-family', quote(String(font.family ?? ''))),
    ...(font.style ? declaration('font-style', fontStyle(String(font.style))) : []),
  ]
}

function tokenizedValue(value: DiffValue): string {
  const token = value.tokens?.find((candidate) => candidate.status === 'resolved')
  if (!token) return value.preview.replace(' px', 'px').replace(' deg', 'deg')
  const name = `--${sanitizeIdentifier(`${token.collectionName}-${token.variableName}`)}`
  const fallback = value.preview
    .replace(' px', 'px')
    .replace(' deg', 'deg')
    .replace(' %', '%')
  return `var(${name}, ${fallback || token.resolvedPreview})`
}

function scalarWithUnit(value: DiffValue, unit: string): string {
  const tokenized = tokenizedValue(value)
  if (tokenized.includes('var(')) return tokenized
  const parsed = parseDetail(value)
  return typeof parsed === 'number' ? `${parsed}${unit}` : tokenized
}

function dimensionObject(value: unknown, source: DiffValue): string {
  if (source.tokens?.length) return tokenizedValue(source)
  if (!value || typeof value !== 'object') return String(value)
  const dimension = value as Record<string, unknown>
  if (dimension.unit === 'AUTO') return 'normal'
  if (typeof dimension.value !== 'number') return String(value)
  return `${dimension.value}${dimension.unit === 'PERCENT' ? '%' : 'px'}`
}

function declaration(property: string, value: string): string[] {
  return value && value !== 'undefined' ? [`  ${property}: ${value};`] : []
}

function comment(message: string): string[] {
  return [`  /* ${message}. */`]
}

function parseDetail(value: DiffValue): any {
  try {
    return JSON.parse(value.detail)
  } catch {
    if (value.detail === 'true') return true
    if (value.detail === 'false') return false
    const numeric = Number(value.detail)
    return Number.isNaN(numeric) ? value.detail : numeric
  }
}

function color(value: any): string {
  if (!value) return 'transparent'
  const alpha = typeof value.a === 'number' ? value.a : 1
  return `rgba(${Math.round(value.r * 255)}, ${Math.round(value.g * 255)}, ${Math.round(value.b * 255)}, ${alpha})`
}

function textCase(value: unknown): string {
  return value === 'UPPER' ? 'uppercase' : value === 'LOWER' ? 'lowercase' : value === 'TITLE' ? 'capitalize' : 'none'
}

function flexAlignment(value: unknown): string {
  const map: Record<string, string> = {
    MIN: 'flex-start',
    MAX: 'flex-end',
    CENTER: 'center',
    SPACE_BETWEEN: 'space-between',
    BASELINE: 'baseline',
  }
  return map[String(value)] ?? kebab(String(value))
}

function fontStyle(value: string): string {
  const normalized = value.toLowerCase()
  return normalized.includes('italic') ? 'italic' : normalized.includes('oblique') ? 'oblique' : 'normal'
}

function quote(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`
}

function kebab(value: string): string {
  return value.toLowerCase().replaceAll('_', '-')
}

export function sanitizeIdentifier(value: string): string {
  const sanitized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return sanitized || 'figma-layer'
}

function countSelectors(names: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const name of names) {
    const key = sanitizeIdentifier(name)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}
