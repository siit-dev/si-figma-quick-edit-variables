import type {
  DiffCategory,
  DiffValue,
  SerializableColor,
  VariableProvenance,
} from './types'

export const DIFF_CATEGORIES: Array<{ id: DiffCategory; label: string }> = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'typography', label: 'Typography' },
  { id: 'spacing', label: 'Spacing' },
  { id: 'geometry', label: 'Geometry' },
  { id: 'visibility', label: 'Visibility' },
  { id: 'structure', label: 'Structure' },
]

export function friendlyFieldLabel(field: string): string {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase())
}

export function normalizeDiffValue(
  value: unknown,
  options: {
    unit?: string
    tokens?: VariableProvenance[]
    preview?: string
  } = {},
): DiffValue {
  const tokens = options.tokens?.length ? options.tokens : undefined
  if (value === undefined) {
    return { preview: 'Unavailable', detail: '', kind: 'unavailable', tokens }
  }
  if (value === null) {
    return { preview: 'None', detail: 'null', kind: 'empty', tokens }
  }
  if (typeof value === 'string') {
    return {
      preview:
        options.preview ??
        (value.length > 80 ? `${value.slice(0, 77)}...` : value),
      detail: JSON.stringify(value),
      kind: 'scalar',
      tokens,
    }
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return {
      preview:
        options.preview ??
        `${formatNumber(value)}${typeof value === 'number' && options.unit ? ` ${options.unit}` : ''}`,
      detail: String(value),
      kind: 'scalar',
      tokens,
    }
  }
  if (isColor(value)) {
    const normalizedColor = {
      r: round(value.r),
      g: round(value.g),
      b: round(value.b),
      ...(value.a === undefined ? {} : { a: round(value.a) }),
    }
    return {
      preview: options.preview ?? colorToHex(value),
      detail: stableStringify(normalizedColor),
      kind: 'color',
      color: value,
      tokens,
    }
  }
  const normalized = normalizeComplex(value)
  const detail = stableStringify(normalized)
  return {
    preview: options.preview ?? summarizeComplex(normalized),
    detail,
    kind: 'complex',
    tokens,
  }
}

function normalizeComplex(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'number') return round(value)
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
    if (key === 'boundVariables') continue
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

function formatNumber(value: number | boolean): string {
  if (typeof value === 'boolean') return String(value)
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000)
}

function round(value: number): number {
  return Math.round(value * 100000) / 100000
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
