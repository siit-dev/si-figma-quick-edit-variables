import { SETTINGS_PLUGIN_DATA_KEY } from '../shared/constants'
import {
  DEFAULT_SETTINGS,
  getVariableGroupPath,
  isVariableExcluded,
  migrateSettings,
} from '../shared/settings'
import type {
  SettingsTreeCollection,
  SharedSettingsV1,
  VariableSummary,
} from '../shared/types'

export function loadSettings(): SharedSettingsV1 {
  const raw = figma.root.getPluginData(SETTINGS_PLUGIN_DATA_KEY)
  if (!raw) return DEFAULT_SETTINGS
  try {
    return migrateSettings(JSON.parse(raw))
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: SharedSettingsV1): SharedSettingsV1 {
  const normalized = migrateSettings(settings)
  figma.root.setPluginData(SETTINGS_PLUGIN_DATA_KEY, JSON.stringify(normalized))
  return normalized
}

export function buildVariableSummaries(
  variables: Variable[],
  collections: Map<string, VariableCollection>,
  settings: SharedSettingsV1,
): VariableSummary[] {
  return variables.map((variable) => {
    const collection = collections.get(variable.variableCollectionId)
    const base: VariableSummary = {
      id: variable.id,
      name: variable.name,
      collectionId: variable.variableCollectionId,
      collectionName: collection?.name ?? 'Unknown collection',
      resolvedType: variable.resolvedType,
      remote: variable.remote,
      scopes: [...variable.scopes],
      groupPath: getVariableGroupPath(variable.name),
      valuePreview: previewDefaultValue(variable, collection),
      excluded: false,
    }
    return { ...base, excluded: isVariableExcluded(base, settings) }
  })
}

export function buildSettingsTree(variables: VariableSummary[]): SettingsTreeCollection[] {
  const byCollection = new Map<string, VariableSummary[]>()
  for (const variable of variables) {
    const list = byCollection.get(variable.collectionId) ?? []
    list.push(variable)
    byCollection.set(variable.collectionId, list)
  }

  return [...byCollection.entries()]
    .map(([id, collectionVariables]) => {
      const groupCounts = new Map<string, number>()
      for (const variable of collectionVariables) {
        if (!variable.groupPath) continue
        const parts = variable.groupPath.split('/')
        for (let index = 1; index <= parts.length; index += 1) {
          const path = parts.slice(0, index).join('/')
          groupCounts.set(path, (groupCounts.get(path) ?? 0) + 1)
        }
      }
      return {
        id,
        name: collectionVariables[0]?.collectionName ?? 'Unknown collection',
        variableCount: collectionVariables.length,
        groups: [...groupCounts.entries()]
          .map(([path, variableCount]) => ({
            path,
            label: path.split('/').at(-1) ?? path,
            variableCount,
          }))
          .sort((a, b) => a.path.localeCompare(b.path)),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function previewDefaultValue(variable: Variable, collection?: VariableCollection): string {
  if (!collection) return 'Unavailable'
  const value = variable.valuesByMode[collection.defaultModeId]
  if (value === undefined) return 'Unavailable'
  if (typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
    return `Alias → ${value.id}`
  }
  if (typeof value === 'object') {
    const color = value as RGB | RGBA
    return `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`
  }
  return String(value)
}
