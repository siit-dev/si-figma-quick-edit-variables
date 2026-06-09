import type { ResolvedType, SerializableColor, SerializableValue } from './types'

export function isAlias(value: SerializableValue | null): value is { type: 'VARIABLE_ALIAS'; id: string } {
  return Boolean(value && typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS')
}

export function formatValue(value: SerializableValue | null): string {
  if (value === null) return 'Unavailable'
  if (isAlias(value)) return `Alias → ${value.id}`
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'number') return Number.isInteger(value) ? `${value}` : value.toFixed(2)
  if (typeof value === 'string') return value
  return colorToHex(value)
}

export function colorToHex(color: SerializableColor): string {
  const channel = (value: number) =>
    Math.round(Math.max(0, Math.min(1, value)) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  const alpha = color.a === undefined || color.a >= 1 ? '' : channel(color.a)
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}${alpha}`
}

export function parseValue(type: ResolvedType, input: string): SerializableValue {
  if (type === 'STRING') return input
  if (type === 'BOOLEAN') {
    const normalized = input.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
    throw new Error('Boolean values must be true or false.')
  }
  if (type === 'FLOAT') {
    const parsed = Number(input)
    if (!Number.isFinite(parsed)) throw new Error('Enter a finite number.')
    return parsed
  }
  return parseHexColor(input)
}

export function parseHexColor(input: string): SerializableColor {
  const value = input.trim().replace(/^#/, '')
  if (![3, 4, 6, 8].includes(value.length) || !/^[0-9a-f]+$/i.test(value)) {
    throw new Error('Enter a hex color such as #3366FF or #3366FFCC.')
  }

  const expanded =
    value.length <= 4
      ? value
          .split('')
          .map((character) => character + character)
          .join('')
      : value

  const number = Number.parseInt(expanded, 16)
  const hasAlpha = expanded.length === 8
  return {
    r: ((number >> (hasAlpha ? 24 : 16)) & 255) / 255,
    g: ((number >> (hasAlpha ? 16 : 8)) & 255) / 255,
    b: ((number >> (hasAlpha ? 8 : 0)) & 255) / 255,
    ...(hasAlpha ? { a: (number & 255) / 255 } : {}),
  }
}
