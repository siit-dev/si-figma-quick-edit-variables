import type { BindingAdapter, DiscoveredBinding } from './types'
import { isAlias } from './types'

export const effectAdapter: BindingAdapter = {
  kind: 'effect',
  scan(node): DiscoveredBinding[] {
    if (!('effects' in node)) return []
    return node.effects.flatMap((effect, index) =>
      Object.entries(effect.boundVariables ?? {}).flatMap(([field, alias]) =>
        isAlias(alias)
          ? [
              {
                locator: { kind: 'effect', field: 'effects', index, subfield: field },
                alias,
                propertyLabel: `Effect ${index + 1} ${field}`,
              },
            ]
          : [],
      ),
    )
  },
}
