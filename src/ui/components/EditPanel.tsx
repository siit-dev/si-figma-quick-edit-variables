import { useMemo, useState } from 'react'
import type {
  BindingOccurrence,
  MutationDraft,
  SerializableValue,
  VariableSummary,
} from '../../shared/types'
import { formatValue, isAlias, parseValue } from '../../shared/values'
import { VariablePicker } from './VariablePicker'

type Action = 'source' | 'alias'

type Props = {
  occurrence: BindingOccurrence
  variables: VariableSummary[]
  busy: boolean
  onCancel: () => void
  onApply: (draft: MutationDraft) => void
}

export function EditPanel({ occurrence, variables, busy, onCancel, onApply }: Props) {
  const defaultAction: Action = 'source'
  const [action, setAction] = useState<Action>(defaultAction)
  const [modeId, setModeId] = useState(occurrence.resolvedModeId)
  const [rawInput, setRawInput] = useState(() => editableInitialValue(occurrence))
  const [targetVariableId, setTargetVariableId] = useState('')
  const [validation, setValidation] = useState('')

  const selectedMode = useMemo(
    () => occurrence.modes.find((mode) => mode.id === modeId),
    [modeId, occurrence.modes],
  )

  function apply() {
    setValidation('')
    try {
      let draft: MutationDraft
      if (action === 'alias') {
        if (!targetVariableId) throw new Error('Select a variable.')
        draft = {
          kind: 'set-alias',
          occurrenceId: occurrence.id,
          revision: occurrence.revision,
          modeId,
          targetVariableId,
        }
      } else {
        draft = {
          kind: 'edit-source',
          occurrenceId: occurrence.id,
          revision: occurrence.revision,
          modeId,
          value: parseValue(occurrence.resolvedType, rawInput),
        }
      }
      onApply(draft)
    } catch (error) {
      setValidation(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div className="panel-overlay" role="dialog" aria-modal="true" aria-label="Edit variable binding">
      <div className="edit-panel">
        <header className="edit-header">
          <div>
            <div className="eyebrow">{occurrence.nodeName}</div>
            <h2>{occurrence.propertyLabel}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Close">
            x
          </button>
        </header>

        <div className="binding-summary">
          <span>{occurrence.variableCollectionName}</span>
          <strong>{occurrence.variableName}</strong>
          <span>
            {occurrence.resolvedModeName} · {occurrence.modeOrigin}
          </span>
        </div>

        <div className="tabs" role="tablist">
          <button
            type="button"
            className={action === 'source' ? 'active' : ''}
            disabled={!occurrence.canEditSource}
            onClick={() => setAction('source')}
          >
            Edit value
          </button>
          <button
            type="button"
            className={action === 'alias' ? 'active' : ''}
            disabled={!occurrence.canEditSource}
            onClick={() => setAction('alias')}
          >
            Set alias
          </button>
        </div>

        {(action === 'source' || action === 'alias') && occurrence.modes.length > 1 ? (
          <label className="field">
            <span>Mode</span>
            <select value={modeId} onChange={(event) => setModeId(event.target.value)}>
              {occurrence.modes.map((mode) => (
                <option value={mode.id} key={mode.id}>
                  {mode.name}
                  {mode.id === occurrence.resolvedModeId ? ' (resolved)' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {action === 'alias' ? (
          <VariablePicker
            occurrence={occurrence}
            variables={variables}
            value={targetVariableId}
            onChange={setTargetVariableId}
          />
        ) : (
          <ValueEditor
            type={occurrence.resolvedType}
            value={rawInput}
            onChange={setRawInput}
          />
        )}

        {action === 'source' ? (
          <div className="warning">
            This changes <strong>{occurrence.variableName}</strong> in{' '}
            <strong>{selectedMode?.name}</strong> for every consumer.
            {isAlias(occurrence.rawValue)
              ? ' The existing alias in this mode will be replaced by a raw value.'
              : ''}
          </div>
        ) : null}
        {action === 'alias' ? (
          <div className="warning">
            This changes the source variable for every consumer in {selectedMode?.name}. The node
            remains bound to {occurrence.variableName}.
          </div>
        ) : null}
        {!occurrence.canEditSource ? (
          <div className="notice">
            {occurrence.readOnlyReason ?? 'This source variable cannot be edited.'}
          </div>
        ) : null}
        {validation ? <div className="error-inline">{validation}</div> : null}

        <footer className="edit-actions">
          <button type="button" className="button secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="button primary"
            disabled={busy || !occurrence.canEditSource}
            onClick={apply}
          >
            {busy ? 'Applying...' : 'Apply'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function ValueEditor({
  type,
  value,
  onChange,
}: {
  type: BindingOccurrence['resolvedType']
  value: string
  onChange: (value: string) => void
}) {
  if (type === 'BOOLEAN') {
    return (
      <label className="field">
        <span>Value</span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      </label>
    )
  }
  return (
    <label className="field">
      <span>{type === 'COLOR' ? 'Hex color' : type === 'FLOAT' ? 'Number' : 'Text'}</span>
      <div className="value-input-row">
        {type === 'COLOR' ? (
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
            onChange={(event) => onChange(event.target.value)}
            aria-label="Color"
          />
        ) : null}
        <input
          autoFocus
          type={type === 'FLOAT' ? 'number' : 'text'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  )
}

function editableInitialValue(occurrence: BindingOccurrence): string {
  if (occurrence.rawValue !== null && !isAlias(occurrence.rawValue)) {
    return formatValue(occurrence.rawValue)
  }
  return occurrence.resolvedValue === null || isAlias(occurrence.resolvedValue)
    ? ''
    : formatValue(occurrence.resolvedValue)
}
