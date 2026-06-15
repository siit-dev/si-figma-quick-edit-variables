import { normalizeDiffValue } from '../../shared/diff'
import type {
  ResolvedType,
  VariableAliasStep,
  VariableProvenance,
} from '../../shared/types'
import type { AliasReference } from './types'

export class VisualVariableResolver {
  private readonly variables = new Map<string, Variable | null>()
  private readonly collections = new Map<string, VariableCollection | null>()

  async resolve(
    consumer: SceneNode,
    aliases: AliasReference[] = [],
  ): Promise<VariableProvenance[]> {
    const unique = [...new Map(aliases.map((alias) => [alias.id, alias])).values()]
    const result: VariableProvenance[] = []
    for (const alias of unique) result.push(await this.resolveOne(consumer, alias.id))
    return result
  }

  private async resolveOne(
    consumer: SceneNode,
    variableId: string,
  ): Promise<VariableProvenance> {
    const aliasChain: VariableAliasStep[] = []
    const visited = new Set<string>()
    let currentId = variableId
    let primary: Variable | null = null
    let primaryStep: VariableAliasStep | null = null
    let status: VariableProvenance['status'] = 'resolved'

    while (currentId) {
      if (visited.has(currentId)) {
        status = 'cycle'
        break
      }
      visited.add(currentId)
      const variable = await this.getVariable(currentId)
      if (!variable) {
        status = 'missing'
        break
      }
      primary ??= variable
      const collection = await this.getCollection(variable.variableCollectionId)
      if (!collection) {
        status = 'unavailable'
        break
      }
      const modeId =
        consumer.resolvedVariableModes[collection.id] ?? collection.defaultModeId
      const step: VariableAliasStep = {
        variableId: variable.id,
        variableName: variable.name,
        collectionId: collection.id,
        collectionName: collection.name,
        modeId,
        modeName:
          collection.modes.find((mode) => mode.modeId === modeId)?.name ??
          'Unknown mode',
      }
      primaryStep ??= step
      aliasChain.push(step)
      const raw = variable.valuesByMode[modeId]
      if (!isAlias(raw)) break
      currentId = raw.id
    }

    let resolvedPreview = 'Unavailable'
    let resolvedType: ResolvedType | 'UNKNOWN' = primary?.resolvedType ?? 'UNKNOWN'
    if (primary && status === 'resolved') {
      try {
        const resolved = primary.resolveForConsumer(consumer)
        resolvedType = resolved.resolvedType
        resolvedPreview = normalizeDiffValue(resolved.value).preview
      } catch {
        status = 'unavailable'
      }
    }

    const fallback = primaryStep ?? {
      variableId,
      variableName: 'Variable unavailable',
      collectionId: '',
      collectionName: 'Collection unavailable',
      modeId: '',
      modeName: 'Unknown mode',
    }
    return {
      ...fallback,
      resolvedType,
      resolvedPreview,
      status,
      aliasChain,
    }
  }

  private async getVariable(id: string): Promise<Variable | null> {
    if (!this.variables.has(id)) {
      this.variables.set(id, await figma.variables.getVariableByIdAsync(id))
    }
    return this.variables.get(id) ?? null
  }

  private async getCollection(id: string): Promise<VariableCollection | null> {
    if (!this.collections.has(id)) {
      this.collections.set(
        id,
        await figma.variables.getVariableCollectionByIdAsync(id),
      )
    }
    return this.collections.get(id) ?? null
  }
}

function isAlias(value: VariableValue | undefined): value is VariableAlias {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'type' in value &&
      value.type === 'VARIABLE_ALIAS',
  )
}
