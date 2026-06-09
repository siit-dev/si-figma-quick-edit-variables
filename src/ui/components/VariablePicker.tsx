import { useMemo, useState } from 'react'
import { isPickerEligible } from '../../shared/picker'
import type { BindingOccurrence, VariableSummary } from '../../shared/types'

type Props = {
  occurrence: BindingOccurrence
  variables: VariableSummary[]
  value: string
  onChange: (variableId: string) => void
}

export function VariablePicker({ occurrence, variables, value, onChange }: Props) {
  const [search, setSearch] = useState('')
  const eligible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return variables
      .filter((variable) =>
        isPickerEligible(variable, occurrence.resolvedType, occurrence.locator),
      )
      .filter((variable) => {
        if (!query) return true
        return `${variable.collectionName}/${variable.name}`.toLowerCase().includes(query)
      })
      .sort((a, b) =>
        `${a.collectionName}/${a.name}`.localeCompare(`${b.collectionName}/${b.name}`),
      )
  }, [occurrence, search, variables])

  const grouped = useMemo(() => {
    const map = new Map<string, VariableSummary[]>()
    for (const variable of eligible) {
      const list = map.get(variable.collectionName) ?? []
      list.push(variable)
      map.set(variable.collectionName, list)
    }
    return [...map.entries()]
  }, [eligible])

  return (
    <div className="picker">
      <label className="search-field">
        <span aria-hidden="true">/</span>
        <input
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search variables in this file"
        />
      </label>
      <div className="picker-list" role="listbox" aria-label="Compatible local variables">
        {grouped.length === 0 ? (
          <div className="empty compact">No compatible variables match.</div>
        ) : (
          grouped.map(([collectionName, items]) => (
            <div key={collectionName}>
              <div className="picker-group">{collectionName}</div>
              {items.map((variable) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={value === variable.id}
                  className={`picker-item ${value === variable.id ? 'selected' : ''}`}
                  key={variable.id}
                  onClick={() => onChange(variable.id)}
                >
                  <span className="variable-dot" data-type={variable.resolvedType} />
                  <span className="picker-name">{variable.name}</span>
                  <span className="picker-value">{variable.valuePreview}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

