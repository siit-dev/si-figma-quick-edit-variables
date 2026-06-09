import type { BindingAdapter, DiscoveredBinding } from './types'
import { isAlias } from './types'

export const layoutGridAdapter: BindingAdapter = {
  kind: 'layout-grid',
  scan(node): DiscoveredBinding[] {
    if (!('layoutGrids' in node)) return []
    return node.layoutGrids.flatMap((grid, index) =>
      Object.entries(grid.boundVariables ?? {}).flatMap(([field, alias]) =>
        isAlias(alias)
          ? [
              {
                locator: { kind: 'layout-grid', field: 'layoutGrids', index, subfield: field },
                alias,
                propertyLabel: `Layout grid ${index + 1} ${field}`,
              },
            ]
          : [],
      ),
    )
  },
}
