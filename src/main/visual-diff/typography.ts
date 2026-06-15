import type { VisualProperty, VisualPropertyAdapter } from './types'
import { readAliases } from './types'

const FIELDS = [
  ['fontName', 'Font'],
  ['fontSize', 'Font size'],
  ['fontWeight', 'Font weight'],
  ['lineHeight', 'Line height'],
  ['letterSpacing', 'Letter spacing'],
  ['paragraphIndent', 'Paragraph indent'],
  ['paragraphSpacing', 'Paragraph spacing'],
  ['textCase', 'Text case'],
  ['textDecoration', 'Text decoration'],
] as const

export const typographyAdapter: VisualPropertyAdapter = {
  id: 'typography',
  extract(node) {
    if (node.type !== 'TEXT') return []
    const segments = node.getStyledTextSegments([
      'fontName',
      'fontSize',
      'fontWeight',
      'lineHeight',
      'letterSpacing',
      'paragraphIndent',
      'paragraphSpacing',
      'textCase',
      'textDecoration',
      'boundVariables',
    ])
    const properties: VisualProperty[] = []
    for (const [field, label] of FIELDS) {
      const values = unique(
        segments.map(
          (segment) =>
            (segment as unknown as Record<string, unknown>)[field],
        ),
      )
      const aliases = segments.flatMap((segment) =>
        readAliases(
          (segment.boundVariables as Record<string, unknown> | undefined)?.[field],
        ),
      )
      properties.push({
        field,
        label,
        category: 'typography',
        value: values.length === 1 ? values[0] : values,
        preview: typographyPreview(values),
        aliases,
      })
    }
    for (const [field, label] of [
      ['textAlignHorizontal', 'Horizontal alignment'],
      ['textAlignVertical', 'Vertical alignment'],
    ] as const) {
      properties.push({
        field,
        label,
        category: 'typography',
        value: node[field],
      })
    }
    return properties
  },
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

function typographyPreview(values: unknown[]): string {
  if (values.length !== 1) return `${values.length} styles`
  const value = values[0]
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.family === 'string') {
      return `${record.family}${record.style ? ` / ${record.style}` : ''}`
    }
    if (record.unit === 'AUTO') return 'Auto'
    if (typeof record.value === 'number') return `${record.value} ${unitLabel(record.unit)}`
  }
  return String(value)
}

function unitLabel(unit: unknown): string {
  return unit === 'PIXELS' ? 'px' : unit === 'PERCENT' ? '%' : String(unit ?? '')
}
