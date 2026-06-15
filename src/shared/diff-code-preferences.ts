import {
  DEFAULT_DIFF_CODE_PANEL_HEIGHT,
  MAX_DIFF_CODE_PANEL_HEIGHT,
  MIN_DIFF_CODE_PANEL_HEIGHT,
} from './constants'
import type { DiffCodePreferences, DiffCodeScope } from './types'

export const DEFAULT_DIFF_CODE_PREFERENCES: DiffCodePreferences = {
  scope: 'selected-categories',
  height: DEFAULT_DIFF_CODE_PANEL_HEIGHT,
  collapsed: false,
}

export function normalizeDiffCodePreferences(value: unknown): DiffCodePreferences {
  const candidate =
    value && typeof value === 'object'
      ? (value as Partial<DiffCodePreferences>)
      : {}
  return {
    scope: normalizeScope(candidate.scope),
    height: clampDiffCodePanelHeight(candidate.height),
    collapsed: candidate.collapsed === true,
  }
}

export function clampDiffCodePanelHeight(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value)
    ? value
    : DEFAULT_DIFF_CODE_PANEL_HEIGHT
  return Math.round(
    Math.max(MIN_DIFF_CODE_PANEL_HEIGHT, Math.min(MAX_DIFF_CODE_PANEL_HEIGHT, numeric)),
  )
}

function normalizeScope(value: unknown): DiffCodeScope {
  return value === 'matched-properties' || value === 'full-layers'
    ? value
    : 'selected-categories'
}
