import type { BindingAdapter, DiscoveredBinding } from './types'
import { isAlias } from './types'

export const componentPropertyAdapter: BindingAdapter = {
  kind: 'component-property',
  scan(node): DiscoveredBinding[] {
    const bindings = node.boundVariables?.componentProperties
    if (!bindings) return []
    return Object.entries(bindings).flatMap(([propertyName, alias]) =>
      isAlias(alias)
        ? [
            {
              locator: {
                kind: 'component-property',
                field: 'componentProperties',
                propertyName,
              },
              alias,
              propertyLabel: `Component property · ${propertyName}`,
            },
          ]
        : [],
    )
  },
}
