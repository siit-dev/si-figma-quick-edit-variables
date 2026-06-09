import type { PropertyLocator } from '../../shared/types'

export type DiscoveredBinding = {
  locator: PropertyLocator
  alias: VariableAlias
  propertyLabel: string
}

export interface BindingAdapter {
  kind: PropertyLocator['kind']
  scan(node: SceneNode): DiscoveredBinding[]
}

export function isAlias(value: unknown): value is VariableAlias {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'type' in value &&
      (value as { type?: string }).type === 'VARIABLE_ALIAS' &&
      'id' in value,
  )
}
