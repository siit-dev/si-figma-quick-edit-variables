import type { BindingAdapter, DiscoveredBinding } from './types'
import { isAlias } from './types'

const TEXT_FIELDS: VariableBindableTextField[] = [
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
  'paragraphSpacing',
  'paragraphIndent',
]

export const textFieldAdapter: BindingAdapter = {
  kind: 'text-field',
  scan(node): DiscoveredBinding[] {
    if (node.type !== 'TEXT') return []
    const segments = node.getStyledTextSegments(['boundVariables'])
    return segments.flatMap((segment) =>
      TEXT_FIELDS.flatMap((field) => {
        const alias = segment.boundVariables?.[field]
        if (!isAlias(alias)) return []
        return [
          {
            locator: {
              kind: 'text-field',
              field,
              start: segment.start,
              end: segment.end,
            },
            alias,
            propertyLabel: `${field} · characters ${segment.start}–${segment.end}`,
          },
        ]
      }),
    )
  },
}

export const textRangeFillAdapter: BindingAdapter = {
  kind: 'text-range-fill',
  scan(node): DiscoveredBinding[] {
    if (node.type !== 'TEXT') return []
    const segments = node.getStyledTextSegments(['fills'])
    return segments.flatMap((segment) =>
      segment.fills.flatMap((paint, index) => {
        if (paint.type !== 'SOLID' || !paint.boundVariables?.color) return []
        return [
          {
            locator: {
              kind: 'text-range-fill',
              field: 'fills',
              subfield: 'color',
              index,
              start: segment.start,
              end: segment.end,
            },
            alias: paint.boundVariables.color,
            propertyLabel: `Text fill ${index + 1} · characters ${segment.start}–${segment.end}`,
          },
        ]
      }),
    )
  },
}
