import type { VisualProperty, VisualPropertyAdapter } from './types'
import { readAliases, readBoundAliases } from './types'

export const appearanceAdapter: VisualPropertyAdapter = {
  id: 'appearance',
  extract(node) {
    const properties: VisualProperty[] = []
    addScalar(properties, node, 'opacity', 'Opacity')
    addScalar(properties, node, 'blendMode', 'Blend mode')
    addScalar(properties, node, 'isMask', 'Mask')
    addScalar(properties, node, 'maskType', 'Mask type')
    addScalar(properties, node, 'clipsContent', 'Clip content')

    if ('fills' in node) {
      const fills = readPaints(node, 'fills')
      if (fills) {
        properties.push({
          field: 'fills',
          label: node.type === 'TEXT' ? 'Text fill' : 'Fill',
          category: 'appearance',
          value: fills.value,
          preview: fills.preview,
          aliases: fills.aliases,
        })
      }
    }
    if ('strokes' in node) {
      const strokes = readPaints(node, 'strokes')
      if (strokes) {
        properties.push({
          field: 'strokes',
          label: 'Stroke',
          category: 'appearance',
          value: strokes.value,
          preview: strokes.preview,
          aliases: strokes.aliases,
        })
      }
    }
    if ('effects' in node) {
      properties.push({
        field: 'effects',
        label: 'Effects',
        category: 'appearance',
        value: node.effects.map(stripEffect),
        preview: effectPreview(node.effects),
        aliases: node.effects.flatMap((effect) =>
          Object.values(effect.boundVariables ?? {}).flatMap(readAliases),
        ),
      })
    }

    for (const [field, label] of [
      ['cornerRadius', 'Corner radius'],
      ['cornerSmoothing', 'Corner smoothing'],
      ['topLeftRadius', 'Top-left radius'],
      ['topRightRadius', 'Top-right radius'],
      ['bottomLeftRadius', 'Bottom-left radius'],
      ['bottomRightRadius', 'Bottom-right radius'],
      ['strokeWeight', 'Stroke weight'],
      ['strokeTopWeight', 'Stroke top weight'],
      ['strokeRightWeight', 'Stroke right weight'],
      ['strokeBottomWeight', 'Stroke bottom weight'],
      ['strokeLeftWeight', 'Stroke left weight'],
      ['strokeAlign', 'Stroke alignment'],
      ['strokeCap', 'Stroke cap'],
      ['strokeJoin', 'Stroke join'],
      ['dashPattern', 'Dash pattern'],
    ] as const) {
      addScalar(properties, node, field, label, typeof read(node, field) === 'number' ? 'px' : undefined)
    }
    return properties
  },
}

function addScalar(
  properties: VisualProperty[],
  node: SceneNode,
  field: string,
  label: string,
  unit?: string,
) {
  const value = read(node, field)
  if (value === undefined || value === figma.mixed) return
  properties.push({
    field,
    label,
    category: 'appearance',
    value,
    unit,
    aliases: readBoundAliases(node, field),
  })
}

function read(node: SceneNode, field: string): unknown {
  try {
    return (node as unknown as Record<string, unknown>)[field]
  } catch {
    return undefined
  }
}

function readPaints(node: SceneNode, field: 'fills' | 'strokes') {
  const paints = (node as unknown as Record<string, unknown>)[field]
  if (paints === figma.mixed) {
    if (node.type !== 'TEXT') return null
    const segments = node.getStyledTextSegments(['fills'])
    const values = unique(
      segments.map((segment) => segment.fills.map(stripPaint)),
    )
    const aliases = segments.flatMap((segment) =>
      segment.fills.flatMap((paint) =>
        Object.values(readPaintBindings(paint)).flatMap(readAliases),
      ),
    )
    return {
      value: values,
      preview: values.length === 1 ? paintListPreview(values[0] as unknown[]) : `${values.length} text styles`,
      aliases,
    }
  }
  if (!Array.isArray(paints)) return null
  const typedPaints = paints as Paint[]
  const value = typedPaints.map(stripPaint)
  return {
    value,
    preview: paintListPreview(value),
    aliases: typedPaints.flatMap((paint) =>
      Object.values(readPaintBindings(paint)).flatMap(readAliases),
    ),
  }
}

function readPaintBindings(paint: Paint): Record<string, unknown> {
  return (
    (paint as unknown as { boundVariables?: Record<string, unknown> })
      .boundVariables ?? {}
  )
}

function stripPaint(paint: Paint): unknown {
  const source = paint as unknown as Record<string, unknown>
  const output: Record<string, unknown> = {}
  for (const key of Object.keys(source).sort()) {
    if (key === 'boundVariables' || key === 'imageHash') continue
    output[key] = source[key]
  }
  return output
}

function stripEffect(effect: Effect): unknown {
  const source = effect as unknown as Record<string, unknown>
  const output: Record<string, unknown> = {}
  for (const key of Object.keys(source).sort()) {
    if (key === 'boundVariables') continue
    output[key] = source[key]
  }
  return output
}

function paintListPreview(paints: unknown[]): string {
  if (paints.length === 0) return 'None'
  if (paints.length > 1) return `${paints.length} paints`
  const paint = paints[0] as Record<string, unknown>
  if (paint.type === 'SOLID' && isColor(paint.color)) return colorToHex(paint.color)
  return String(paint.type ?? 'Paint')
}

function effectPreview(effects: readonly Effect[]): string {
  if (effects.length === 0) return 'None'
  if (effects.length > 1) return `${effects.length} effects`
  return effects[0]?.type.replaceAll('_', ' ').toLowerCase() ?? 'Effect'
}

function unique(values: unknown[]): unknown[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = JSON.stringify(value)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function isColor(value: unknown): value is RGB | RGBA {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as RGB).r === 'number' &&
      typeof (value as RGB).g === 'number' &&
      typeof (value as RGB).b === 'number',
  )
}

function colorToHex(color: RGB | RGBA): string {
  const channel = (value: number) =>
    Math.round(Math.max(0, Math.min(1, value)) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  const alpha = 'a' in color && color.a < 1 ? channel(color.a) : ''
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}${alpha}`
}
