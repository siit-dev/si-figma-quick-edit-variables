import type { VisualProperty, VisualPropertyAdapter } from './types'
import { readBoundAliases } from './types'

const FIELDS = [
  ['paddingLeft', 'Padding left'],
  ['paddingRight', 'Padding right'],
  ['paddingTop', 'Padding top'],
  ['paddingBottom', 'Padding bottom'],
  ['itemSpacing', 'Item spacing'],
  ['counterAxisSpacing', 'Wrapped-row spacing'],
] as const

export const spacingAdapter: VisualPropertyAdapter = {
  id: 'spacing',
  extract(node) {
    if (!('layoutMode' in node) || node.layoutMode === 'NONE') return []
    return FIELDS.flatMap(([field, label]) => {
      const value = node[field]
      if (value === null || value === undefined) return []
      return [{
        field,
        label,
        category: 'spacing' as const,
        value,
        unit: 'px',
        aliases: readBoundAliases(node, field),
      }]
    })
  },
}
