import type { DiffCategory, DiffValue, SerializableColor } from './types'

const CATEGORY_FIELDS: Record<DiffCategory, Set<string>> = {
  'component-properties': new Set(['componentProperties', 'componentPropertyReferences']),
  content: new Set(['characters', 'text', 'visible', 'name', 'mediaData', 'embedData', 'linkUnfurlData']),
  appearance: new Set([
    'fills',
    'strokes',
    'opacity',
    'blendMode',
    'effects',
    'fillStyleId',
    'strokeStyleId',
    'effectStyleId',
    'cornerRadius',
    'cornerSmoothing',
    'topLeftRadius',
    'topRightRadius',
    'bottomLeftRadius',
    'bottomRightRadius',
  ]),
  typography: new Set([
    'fontName',
    'fontSize',
    'lineHeight',
    'letterSpacing',
    'paragraphIndent',
    'paragraphSpacing',
    'textAlignHorizontal',
    'textAlignVertical',
    'textCase',
    'textDecoration',
    'textStyleId',
    'styledTextSegments',
  ]),
  layout: new Set([
    'width',
    'height',
    'minWidth',
    'maxWidth',
    'minHeight',
    'maxHeight',
    'x',
    'y',
    'relativeTransform',
    'rotation',
    'constraints',
    'layoutMode',
    'layoutWrap',
    'layoutGrids',
    'gridStyleId',
    'paddingLeft',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'itemSpacing',
    'counterAxisSpacing',
    'layoutAlign',
    'layoutGrow',
    'layoutPositioning',
    'primaryAxisSizingMode',
    'counterAxisSizingMode',
    'primaryAxisAlignItems',
    'counterAxisAlignItems',
    'clipsContent',
    'overflowDirection',
  ]),
  prototype: new Set([
    'reactions',
    'hyperlink',
    'flowStartingPoints',
    'overlayPositionType',
    'overlayBackgroundInteraction',
    'overlayBackground',
    'prototypeStartNode',
    'prototypeBackgrounds',
  ]),
  other: new Set(),
}

export const DIFF_CATEGORIES: Array<{ id: DiffCategory; label: string }> = [
  { id: 'component-properties', label: 'Component properties' },
  { id: 'content', label: 'Content' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'typography', label: 'Typography' },
  { id: 'layout', label: 'Layout' },
  { id: 'prototype', label: 'Prototype' },
  { id: 'other', label: 'Other' },
]

export function categoryForField(field: string): DiffCategory {
  for (const [category, fields] of Object.entries(CATEGORY_FIELDS)) {
    if (fields.has(field)) return category as DiffCategory
  }
  return 'other'
}

export function friendlyFieldLabel(field: string): string {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase())
}

export function friendlyPropertyName(propertyKey: string): string {
  return propertyKey.replace(/#[^#]+$/, '')
}

export function normalizeDiffValue(value: unknown): DiffValue {
  if (value === undefined) {
    return { preview: 'Original unavailable', detail: '', kind: 'unavailable' }
  }
  if (value === null) return { preview: 'None', detail: 'null', kind: 'empty' }
  if (typeof value === 'string') {
    return {
      preview: value.length > 80 ? `${value.slice(0, 77)}...` : value,
      detail: JSON.stringify(value),
      kind: 'scalar',
    }
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { preview: String(value), detail: String(value), kind: 'scalar' }
  }
  if (isColor(value)) {
    return {
      preview: colorToHex(value),
      detail: stableStringify(value),
      kind: 'color',
      color: value,
    }
  }
  const normalized = normalizeComplex(value)
  const detail = stableStringify(normalized)
  return {
    preview: summarizeComplex(normalized),
    detail,
    kind: 'complex',
  }
}

function normalizeComplex(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return '[Circular]'
  seen.add(value)
  if (Array.isArray(value)) return value.map((item) => normalizeComplex(item, seen))

  const output: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    if (['parent', 'children', 'removed'].includes(key)) continue
    let next: unknown
    try {
      next = (value as Record<string, unknown>)[key]
    } catch {
      next = '[Unavailable]'
    }
    if (typeof next === 'function' || typeof next === 'symbol') continue
    output[key] = normalizeComplex(next, seen)
  }
  return output
}

function summarizeComplex(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.type === 'string') return record.type
    return `${Object.keys(record).length} fields`
  }
  return String(value)
}

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function isColor(value: unknown): value is SerializableColor {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as SerializableColor).r === 'number' &&
      typeof (value as SerializableColor).g === 'number' &&
      typeof (value as SerializableColor).b === 'number',
  )
}

function colorToHex(color: SerializableColor): string {
  const channel = (value: number) =>
    Math.round(Math.max(0, Math.min(1, value)) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  const alpha = color.a === undefined || color.a >= 1 ? '' : channel(color.a)
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}${alpha}`
}

export function valuesEqual(left: unknown, right: unknown): boolean {
  return normalizeDiffValue(left).detail === normalizeDiffValue(right).detail
}

