export type ResolvedType = 'BOOLEAN' | 'COLOR' | 'FLOAT' | 'STRING'
export type AppTab = 'variables' | 'diff'
export type DiffCategory =
  | 'appearance'
  | 'typography'
  | 'spacing'
  | 'geometry'
  | 'visibility'
  | 'structure'
export type DiffCodeScope =
  | 'matched-properties'
  | 'selected-categories'
  | 'full-layers'

export type DiffCodePreferences = {
  scope: DiffCodeScope
  height: number
  collapsed: boolean
}
export type AdapterKind =
  | 'node-field'
  | 'text-field'
  | 'paint'
  | 'effect'
  | 'layout-grid'
  | 'component-property'
  | 'text-range-fill'

export type SerializableColor = {
  r: number
  g: number
  b: number
  a?: number
}

export type SerializableValue =
  | boolean
  | string
  | number
  | SerializableColor
  | { type: 'VARIABLE_ALIAS'; id: string }

export type ModeSummary = {
  id: string
  name: string
}

export type CollectionSummary = {
  id: string
  name: string
  modes: ModeSummary[]
  defaultModeId: string
}

export type VariableSummary = {
  id: string
  name: string
  collectionId: string
  collectionName: string
  resolvedType: ResolvedType
  remote: boolean
  scopes: string[]
  groupPath: string
  valuePreview: string
  excluded: boolean
}

export type PropertyLocator = {
  kind: AdapterKind
  field: string
  index?: number
  subfield?: string
  propertyName?: string
  start?: number
  end?: number
}

export type BindingOccurrence = {
  id: string
  rootId: string
  rootName: string
  nodeId: string
  nodeName: string
  nodeType: string
  nodePath: string[]
  locator: PropertyLocator
  propertyLabel: string
  variableId: string
  variableName: string
  variableCollectionId: string
  variableCollectionName: string
  resolvedType: ResolvedType
  rawValue: SerializableValue | null
  resolvedValue: SerializableValue | null
  resolvedModeId: string
  resolvedModeName: string
  modeOrigin: 'explicit' | 'inherited' | 'default'
  modes: ModeSummary[]
  remote: boolean
  excluded: boolean
  canEditSource: boolean
  readOnlyReason?: string
  revision: string
}

export type ExcludedGroupRule = {
  collectionId: string
  prefix: string
}

export type SharedSettingsV1 = {
  version: 1
  excludedCollectionIds: string[]
  excludedGroups: ExcludedGroupRule[]
}

export type SettingsTreeGroup = {
  path: string
  label: string
  variableCount: number
}

export type SettingsTreeCollection = {
  id: string
  name: string
  variableCount: number
  groups: SettingsTreeGroup[]
}

export type ScanPayload = {
  roots: Array<{ id: string; name: string }>
  occurrences: BindingOccurrence[]
  variables: VariableSummary[]
  collections: CollectionSummary[]
  settings: SharedSettingsV1
  settingsTree: SettingsTreeCollection[]
  scannedAt: number
}

export type DiffValue = {
  preview: string
  detail: string
  kind: 'empty' | 'scalar' | 'color' | 'complex' | 'unavailable'
  color?: SerializableColor
  tokens?: VariableProvenance[]
}

export type VariableAliasStep = {
  variableId: string
  variableName: string
  collectionId: string
  collectionName: string
  modeId: string
  modeName: string
}

export type VariableProvenance = VariableAliasStep & {
  resolvedType: ResolvedType | 'UNKNOWN'
  resolvedPreview: string
  status: 'resolved' | 'missing' | 'cycle' | 'unavailable'
  aliasChain: VariableAliasStep[]
}

export type VisualDifference = {
  id: string
  affectedNodeId: string
  affectedNodeName: string
  affectedNodeType: string
  nodePath: string[]
  field: string
  label: string
  category: DiffCategory
  original: DiffValue
  current: DiffValue
}

export type DiffLayerGroup = {
  nodeId: string
  nodeName: string
  nodeType: string
  nodePath: string[]
  differences: VisualDifference[]
  currentProperties: VisualStyleProperty[]
}

export type VisualStyleProperty = {
  field: string
  label: string
  category: Exclude<DiffCategory, 'structure'>
  value: DiffValue
}

export type InstanceDiff = {
  instanceId: string
  instanceName: string
  instancePath: string[]
  mainComponentId: string | null
  mainComponentName: string
  mainComponentRemote: boolean
  layers: DiffLayerGroup[]
  differenceCount: number
}

export type DiffScanPayload = {
  roots: Array<{ id: string; name: string }>
  instances: InstanceDiff[]
  discoveredInstanceCount: number
  unchangedInstanceCount: number
  scannedAt: number
}

export type EditSourceDraft = {
  kind: 'edit-source'
  occurrenceId: string
  revision: string
  modeId: string
  value: SerializableValue
}

export type SetAliasDraft = {
  kind: 'set-alias'
  occurrenceId: string
  revision: string
  modeId: string
  targetVariableId: string
}

export type MutationDraft = EditSourceDraft | SetAliasDraft

export type PluginError = {
  code: string
  message: string
  details?: string
}

export type MainToUiMessage =
  | {
      type: 'BOOTSTRAP'
      payload: ScanPayload
      diffPayload?: DiffScanPayload
      activeTab: AppTab
      windowSize: WindowSize
      diffCodePreferences: DiffCodePreferences
    }
  | { type: 'SCAN_RESULT'; payload: ScanPayload }
  | { type: 'DIFF_RESULT'; payload: DiffScanPayload }
  | { type: 'ACTIVE_TAB_RESULT'; activeTab: AppTab }
  | { type: 'DIFF_CODE_PREFS_RESULT'; preferences: DiffCodePreferences }
  | { type: 'SELECTION_CHANGED'; hasDraft: boolean }
  | { type: 'MUTATION_RESULT'; payload: ScanPayload; message: string }
  | { type: 'SETTINGS_RESULT'; payload: ScanPayload }
  | { type: 'ERROR'; error: PluginError }

export type UiToMainMessage =
  | { type: 'READY' }
  | { type: 'RESCAN' }
  | { type: 'SET_DRAFT_STATE'; active: boolean }
  | { type: 'APPLY_MUTATION'; draft: MutationDraft }
  | { type: 'SAVE_SETTINGS'; settings: SharedSettingsV1 }
  | { type: 'RESIZE'; size: WindowSize }
  | { type: 'SET_ACTIVE_TAB'; activeTab: AppTab }
  | { type: 'REQUEST_DIFF_SCAN'; useCurrentSelection?: boolean }
  | { type: 'NAVIGATE_DIFF'; nodeId: string }
  | { type: 'SAVE_DIFF_CODE_PREFS'; preferences: DiffCodePreferences }

export type WindowSize = {
  width: number
  height: number
}
