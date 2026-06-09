import type {
  BindingOccurrence,
  CollectionSummary,
  ScanPayload,
  SerializableValue,
} from '../shared/types'
import { bindingAdapters } from './adapters/registry'
import { buildSettingsTree, buildVariableSummaries, loadSettings } from './settings-store'

export async function scanSelection(): Promise<ScanPayload> {
  const settings = loadSettings()
  const [localVariables, localCollections] = await Promise.all([
    figma.variables.getLocalVariablesAsync(),
    figma.variables.getLocalVariableCollectionsAsync(),
  ])
  const collectionMap = new Map(localCollections.map((collection) => [collection.id, collection]))
  const variableMap = new Map(localVariables.map((variable) => [variable.id, variable]))
  const variableSummaries = buildVariableSummaries(localVariables, collectionMap, settings)
  const variableSummaryMap = new Map(variableSummaries.map((variable) => [variable.id, variable]))
  const roots = [...figma.currentPage.selection]
  const occurrences: BindingOccurrence[] = []

  for (const root of roots) {
    for (const node of walk(root)) {
      for (const adapter of bindingAdapters) {
        for (const discovered of safeScan(adapter, node)) {
          const variable =
            variableMap.get(discovered.alias.id) ??
            (await figma.variables.getVariableByIdAsync(discovered.alias.id))
          if (!variable) continue
          const collection =
            collectionMap.get(variable.variableCollectionId) ??
            (await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId))
          if (!collection) continue

          const modeId =
            node.resolvedVariableModes[collection.id] ??
            collection.defaultModeId
          const mode = collection.modes.find((candidate) => candidate.modeId === modeId)
          const rawValue = toSerializable(variable.valuesByMode[modeId] ?? null)
          const resolvedValue = safeResolve(variable, node)
          const summary = variableSummaryMap.get(variable.id)
          const remoteReason = variable.remote
            ? 'Variables from external libraries are read-only in this plugin.'
            : undefined

          const occurrenceBase = {
            rootId: root.id,
            rootName: root.name,
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            nodePath: pathFromRoot(root, node),
            locator: discovered.locator,
            propertyLabel: discovered.propertyLabel,
            variableId: variable.id,
            variableName: variable.name,
            variableCollectionId: collection.id,
            variableCollectionName: collection.name,
            resolvedType: variable.resolvedType,
            rawValue,
            resolvedValue,
            resolvedModeId: modeId,
            resolvedModeName: mode?.name ?? 'Default',
            modeOrigin: node.explicitVariableModes[collection.id]
              ? ('explicit' as const)
              : node.resolvedVariableModes[collection.id]
                ? ('inherited' as const)
                : ('default' as const),
            modes: collection.modes.map((candidate) => ({
              id: candidate.modeId,
              name: candidate.name,
            })),
            remote: variable.remote,
            excluded: summary?.excluded ?? false,
            canEditSource: !variable.remote,
            readOnlyReason: remoteReason,
          }
          const id = occurrenceId(node.id, discovered.locator)
          occurrences.push({
            ...occurrenceBase,
            id,
            revision: revisionOf({
              id,
              variableId: variable.id,
              modeId,
              rawValue,
            }),
          })
        }
      }
    }
  }

  const collections: CollectionSummary[] = localCollections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    defaultModeId: collection.defaultModeId,
    modes: collection.modes.map((mode) => ({ id: mode.modeId, name: mode.name })),
  }))

  return {
    roots: roots.map((node) => ({ id: node.id, name: node.name })),
    occurrences,
    variables: variableSummaries,
    collections,
    settings,
    settingsTree: buildSettingsTree(variableSummaries),
    scannedAt: Date.now(),
  }
}

function* walk(root: SceneNode): Generator<SceneNode> {
  yield root
  if ('children' in root) {
    for (const child of root.children) yield* walk(child)
  }
}

function safeScan(
  adapter: (typeof bindingAdapters)[number],
  node: SceneNode,
): ReturnType<(typeof bindingAdapters)[number]['scan']> {
  try {
    return adapter.scan(node)
  } catch {
    return []
  }
}

function safeResolve(variable: Variable, node: SceneNode): SerializableValue | null {
  try {
    return toSerializable(variable.resolveForConsumer(node).value)
  } catch {
    return null
  }
}

function toSerializable(value: VariableValue | null): SerializableValue | null {
  if (value === null) return null
  if (typeof value !== 'object') return value
  if ('type' in value && value.type === 'VARIABLE_ALIAS') {
    return { type: 'VARIABLE_ALIAS', id: value.id }
  }
  const color = value as RGB | RGBA
  return {
    r: color.r,
    g: color.g,
    b: color.b,
    ...('a' in color ? { a: color.a } : {}),
  }
}

function pathFromRoot(root: SceneNode, node: SceneNode): string[] {
  const path = [node.name]
  let parent = node.parent
  while (parent && parent.id !== root.id && parent.type !== 'PAGE' && parent.type !== 'DOCUMENT') {
    path.unshift(parent.name)
    parent = parent.parent
  }
  if (node.id !== root.id) path.unshift(root.name)
  return path
}

export function occurrenceId(nodeId: string, locator: BindingOccurrence['locator']): string {
  return [
    nodeId,
    locator.kind,
    locator.field,
    locator.index ?? '',
    locator.subfield ?? '',
    locator.propertyName ?? '',
    locator.start ?? '',
    locator.end ?? '',
  ].join('|')
}

function revisionOf(value: unknown): string {
  const input = JSON.stringify(value)
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

