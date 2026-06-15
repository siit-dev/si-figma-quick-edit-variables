import type { DiffCategory } from '../../shared/types'

export type AliasReference = {
  type: 'VARIABLE_ALIAS'
  id: string
}

export type VisualProperty = {
  field: string
  label: string
  category: DiffCategory
  value: unknown
  unit?: string
  preview?: string
  aliases?: AliasReference[]
}

export type VisualPropertyAdapter = {
  id: DiffCategory
  extract(node: SceneNode): VisualProperty[]
}

export function readAliases(value: unknown): AliasReference[] {
  if (isAlias(value)) return [value]
  if (!Array.isArray(value)) return []
  return value.filter(isAlias)
}

export function isAlias(value: unknown): value is AliasReference {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { type?: string }).type === 'VARIABLE_ALIAS' &&
      typeof (value as { id?: string }).id === 'string',
  )
}

export function readBoundAliases(node: SceneNode, field: string): AliasReference[] {
  const bindings = node.boundVariables as Record<string, unknown> | undefined
  return readAliases(bindings?.[field])
}
