import { SETTINGS_SCHEMA_VERSION } from './constants'
import type { SharedSettingsV1, VariableSummary } from './types'

export const DEFAULT_SETTINGS: SharedSettingsV1 = {
  version: SETTINGS_SCHEMA_VERSION,
  excludedCollectionIds: [],
  excludedGroups: [],
}

export function normalizeGroupPath(path: string): string {
  return path
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/')
}

export function getVariableGroupPath(variableName: string): string {
  const normalized = normalizeGroupPath(variableName)
  const parts = normalized.split('/')
  return parts.length > 1 ? parts.slice(0, -1).join('/') : ''
}

export function migrateSettings(input: unknown): SharedSettingsV1 {
  if (!input || typeof input !== 'object') return DEFAULT_SETTINGS
  const value = input as Partial<SharedSettingsV1>
  if (value.version !== 1) return DEFAULT_SETTINGS

  return {
    version: 1,
    excludedCollectionIds: Array.from(
      new Set((value.excludedCollectionIds ?? []).filter((id): id is string => typeof id === 'string')),
    ),
    excludedGroups: Array.from(
      new Map(
        (value.excludedGroups ?? [])
          .filter(
            (rule): rule is SharedSettingsV1['excludedGroups'][number] =>
              Boolean(rule) &&
              typeof rule.collectionId === 'string' &&
              typeof rule.prefix === 'string',
          )
          .map((rule) => {
            const normalized = {
              collectionId: rule.collectionId,
              prefix: normalizeGroupPath(rule.prefix),
            }
            return [`${normalized.collectionId}:${normalized.prefix}`, normalized] as const
          })
          .filter(([, rule]) => rule.prefix.length > 0),
      ).values(),
    ),
  }
}

export function isVariableExcluded(
  variable: Pick<VariableSummary, 'collectionId' | 'groupPath'>,
  settings: SharedSettingsV1,
): boolean {
  if (settings.excludedCollectionIds.includes(variable.collectionId)) return true

  const groupPath = normalizeGroupPath(variable.groupPath)
  return settings.excludedGroups.some((rule) => {
    if (rule.collectionId !== variable.collectionId) return false
    const prefix = normalizeGroupPath(rule.prefix)
    return groupPath === prefix || groupPath.startsWith(`${prefix}/`)
  })
}
