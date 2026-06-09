import { isPickerEligible } from '../shared/picker'
import type {
  BindingOccurrence,
  MutationDraft,
  SerializableValue,
} from '../shared/types'
import { scanSelection } from './scanner'
import { buildVariableSummaries, loadSettings } from './settings-store'

export async function applyMutation(draft: MutationDraft): Promise<string> {
  const snapshot = await scanSelection()
  const occurrence = snapshot.occurrences.find((item) => item.id === draft.occurrenceId)
  if (!occurrence) throw mutationError('STALE_OCCURRENCE', 'The bound property no longer exists.')
  if (occurrence.revision !== draft.revision) {
    throw mutationError('STALE_DRAFT', 'The binding or active mode changed. Review the refreshed value and try again.')
  }

  const source = await requireVariable(occurrence.variableId)

  switch (draft.kind) {
    case 'edit-source': {
      requireSourceEditable(occurrence)
      requireMode(occurrence, draft.modeId)
      source.setValueForMode(draft.modeId, fromSerializable(draft.value))
      return `Updated ${source.name} in ${modeName(occurrence, draft.modeId)}.`
    }
    case 'set-alias': {
      requireSourceEditable(occurrence)
      requireMode(occurrence, draft.modeId)
      const target = await requireVariable(draft.targetVariableId)
      const targetSummary = await summarizeVariable(target)
      if (!isPickerEligible(targetSummary, occurrence.resolvedType, occurrence.locator)) {
        throw mutationError('INELIGIBLE_ALIAS', 'The selected variable is no longer eligible for this property.')
      }
      if (target.id === source.id) {
        throw mutationError('CIRCULAR_ALIAS', 'A variable cannot alias itself.')
      }
      source.setValueForMode(draft.modeId, figma.variables.createVariableAlias(target))
      return `Set ${source.name} to alias ${target.name}.`
    }
  }
}

async function requireVariable(id: string): Promise<Variable> {
  const variable = await figma.variables.getVariableByIdAsync(id)
  if (!variable) throw mutationError('MISSING_VARIABLE', 'The variable no longer exists.')
  return variable
}

function requireSourceEditable(occurrence: BindingOccurrence): void {
  if (!occurrence.canEditSource) {
    throw mutationError('READ_ONLY_VARIABLE', occurrence.readOnlyReason ?? 'The source variable is read-only.')
  }
}

function requireMode(occurrence: BindingOccurrence, modeId: string): void {
  if (!occurrence.modes.some((mode) => mode.id === modeId)) {
    throw mutationError('MISSING_MODE', 'The selected variable mode no longer exists.')
  }
}

function modeName(occurrence: BindingOccurrence, modeId: string): string {
  return occurrence.modes.find((mode) => mode.id === modeId)?.name ?? 'selected mode'
}

function fromSerializable(value: SerializableValue): VariableValue {
  if (typeof value !== 'object') return value
  if ('type' in value && value.type === 'VARIABLE_ALIAS') return value
  return value as RGBA
}

async function summarizeVariable(variable: Variable) {
  const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId)
  if (!collection) throw mutationError('MISSING_COLLECTION', 'The variable collection no longer exists.')
  const settings = loadSettings()
  return buildVariableSummaries(
    [variable],
    new Map([[collection.id, collection]]),
    settings,
  )[0]!
}

function mutationError(code: string, message: string): Error {
  const error = new Error(message)
  error.name = code
  return error
}

export function mutationErrorPayload(error: unknown) {
  if (error instanceof Error) {
    return {
      code: error.name === 'Error' ? 'MUTATION_FAILED' : error.name,
      message: error.message,
      details: error.stack,
    }
  }
  return { code: 'MUTATION_FAILED', message: String(error) }
}
