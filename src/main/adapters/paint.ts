import type { BindingAdapter, DiscoveredBinding } from './types'

function getPaints(node: SceneNode, field: string): readonly Paint[] | PluginAPI['mixed'] | undefined {
  if (field === 'fills' && 'fills' in node) return node.fills
  if (field === 'strokes' && 'strokes' in node) return node.strokes
  return undefined
}

export const paintAdapter: BindingAdapter = {
  kind: 'paint',
  scan(node): DiscoveredBinding[] {
    return (['fills', 'strokes'] as const).flatMap((field) => {
      const paints = getPaints(node, field)
      if (!paints || paints === figma.mixed) return []

      return paints.flatMap((paint, index) => {
        if (paint.type !== 'SOLID' || !paint.boundVariables?.color) return []
        return [
          {
            locator: { kind: 'paint', field, index, subfield: 'color' },
            alias: paint.boundVariables.color,
            propertyLabel: `${field === 'fills' ? 'Fill' : 'Stroke'} ${index + 1} color`,
          },
        ]
      })
    })
  },
}
