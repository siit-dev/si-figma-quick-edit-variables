import { useEffect, useMemo, useState } from 'react'
import type {
  AppTab,
  BindingOccurrence,
  DiffScanPayload,
  MainToUiMessage,
  MutationDraft,
  ScanPayload,
  SharedSettingsV1,
  WindowSize,
} from '../shared/types'
import { send, subscribe } from './messaging'
import { EditPanel } from './components/EditPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { ValuePreview } from './components/ValuePreview'
import { DiffPanel } from './components/DiffPanel'

export function App() {
  const [payload, setPayload] = useState<ScanPayload | null>(null)
  const [diffPayload, setDiffPayload] = useState<DiffScanPayload | null>(null)
  const [activeTab, setActiveTab] = useState<AppTab>('variables')
  const [windowSize, setWindowSize] = useState<WindowSize>({ width: 420, height: 640 })
  const [editing, setEditing] = useState<BindingOccurrence | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [selectionWarning, setSelectionWarning] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const unsubscribe = subscribe(handleMessage)
    send({ type: 'READY' })
    return unsubscribe
  }, [])

  useEffect(() => {
    send({ type: 'SET_DRAFT_STATE', active: Boolean(editing) })
  }, [editing])

  function handleMessage(message: MainToUiMessage) {
    switch (message.type) {
      case 'BOOTSTRAP':
        setPayload(message.payload)
        setDiffPayload(message.diffPayload ?? null)
        setActiveTab(message.activeTab)
        setWindowSize(message.windowSize)
        break
      case 'SCAN_RESULT':
        setPayload(message.payload)
        setError('')
        break
      case 'DIFF_RESULT':
        setDiffPayload(message.payload)
        setError('')
        break
      case 'ACTIVE_TAB_RESULT':
        setActiveTab(message.activeTab)
        if (message.activeTab === 'diff') setEditing(null)
        break
      case 'SELECTION_CHANGED':
        setSelectionWarning(message.hasDraft)
        break
      case 'MUTATION_RESULT':
        setPayload(message.payload)
        setEditing(null)
        setBusy(false)
        setToast(message.message)
        setError('')
        break
      case 'SETTINGS_RESULT':
        setPayload(message.payload)
        setSettingsOpen(false)
        setBusy(false)
        setToast('Shared picker exclusions saved.')
        break
      case 'ERROR':
        setBusy(false)
        setError(message.error.message)
        break
    }
  }

  function apply(draft: MutationDraft) {
    setBusy(true)
    setError('')
    send({ type: 'APPLY_MUTATION', draft })
  }

  function saveSettings(settings: SharedSettingsV1) {
    setBusy(true)
    setError('')
    send({ type: 'SAVE_SETTINGS', settings })
  }

  const grouped = useMemo(() => {
    if (!payload) return []
    const query = filter.trim().toLowerCase()
    const occurrences = payload.occurrences.filter((occurrence) => {
      if (!query) return true
      return [
        occurrence.rootName,
        occurrence.nodeName,
        occurrence.propertyLabel,
        occurrence.variableName,
        occurrence.variableCollectionName,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
    const groups = new Map<string, BindingOccurrence[]>()
    for (const occurrence of occurrences) {
      const list = groups.get(occurrence.rootId) ?? []
      list.push(occurrence)
      groups.set(occurrence.rootId, list)
    }
    return [...groups.entries()].map(([rootId, items]) => ({
      rootId,
      rootName: items[0]?.rootName ?? 'Selection',
      items,
    }))
  }, [filter, payload])

  if (!payload) {
    return <div className="loading">Scanning selected layers...</div>
  }

  if (settingsOpen) {
    return (
      <>
        <SettingsPanel
          payload={payload}
          busy={busy}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
        />
        <ResizeGrip size={windowSize} onSize={setWindowSize} />
      </>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">
            {activeTab === 'variables' ? 'Selected variables' : 'Instance override audit'}
          </div>
          <h1>SmartImpact Quick Edit</h1>
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="icon-button"
            title="Refresh selection"
            onClick={() =>
              activeTab === 'diff'
                ? send({ type: 'REQUEST_DIFF_SCAN', useCurrentSelection: true })
                : send({ type: 'RESCAN' })
            }
          >
            R
          </button>
          {activeTab === 'variables' ? (
            <button
              type="button"
              className="icon-button"
              title="Picker exclusions"
              onClick={() => setSettingsOpen(true)}
            >
              S
            </button>
          ) : null}
        </div>
      </header>

      <nav className="app-tabs" aria-label="Plugin capability">
        <button
          type="button"
          className={activeTab === 'variables' ? 'active' : ''}
          onClick={() => send({ type: 'SET_ACTIVE_TAB', activeTab: 'variables' })}
        >
          Variables
        </button>
        <button
          type="button"
          className={activeTab === 'diff' ? 'active' : ''}
          onClick={() => send({ type: 'SET_ACTIVE_TAB', activeTab: 'diff' })}
        >
          Instance Diff
        </button>
      </nav>

      {selectionWarning ? (
        <div className="selection-banner">
          <span>The Figma selection changed while an edit is open.</span>
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setSelectionWarning(false)
              send({ type: 'RESCAN' })
            }}
          >
            Discard and follow selection
          </button>
          <button type="button" onClick={() => setSelectionWarning(false)}>
            Keep editing
          </button>
        </div>
      ) : null}
      {toast ? (
        <button type="button" className="toast" onClick={() => setToast('')}>
          {toast}
        </button>
      ) : null}
      {error ? (
        <button type="button" className="error-banner" onClick={() => setError('')}>
          {error}
        </button>
      ) : null}

      {activeTab === 'variables' ? <><label className="search-field main-search">
        <span aria-hidden="true">/</span>
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter layers, properties, or variables"
        />
      </label>

      <main className="content">
        {payload.roots.length === 0 ? (
          <div className="empty">
            <strong>Select one or more layers.</strong>
            <span>The plugin scans selected layers and all descendants.</span>
          </div>
        ) : payload.occurrences.length === 0 ? (
          <div className="empty">
            <strong>No variable bindings found.</strong>
            <span>Only properties already bound to variables are included in this version.</span>
          </div>
        ) : grouped.length === 0 ? (
          <div className="empty compact">No bindings match this filter.</div>
        ) : (
          grouped.map((group) => (
            <section className="root-group" key={group.rootId}>
              <div className="root-heading">
                <strong>{group.rootName}</strong>
                <span>{group.items.length} bindings</span>
              </div>
              {group.items.map((occurrence) => (
                <button
                  type="button"
                  className="binding-row"
                  key={occurrence.id}
                  onClick={() => setEditing(occurrence)}
                >
                  <div className="binding-primary">
                    <span className="property-name">{occurrence.propertyLabel}</span>
                    <span className="node-path">{occurrence.nodePath.join(' / ')}</span>
                  </div>
                  <div className="binding-secondary">
                    <span className="variable-name">
                      {occurrence.variableCollectionName} / {occurrence.variableName}
                    </span>
                    <ValuePreview value={occurrence.resolvedValue} />
                  </div>
                  <div className="badges">
                    <span>{occurrence.resolvedModeName}</span>
                    {occurrence.excluded ? <span className="badge warning-badge">Excluded</span> : null}
                    {occurrence.remote ? <span className="badge">Library</span> : null}
                    {occurrence.readOnlyReason ? <span className="badge">Limited</span> : null}
                  </div>
                </button>
              ))}
            </section>
          ))
        )}
      </main>

      <footer className="statusbar">
        <span>{payload.occurrences.length} bound properties</span>
        <span>{payload.variables.filter((variable) => !variable.excluded).length} picker variables</span>
      </footer>
      </> : (
        <DiffPanel payload={diffPayload} />
      )}

      {activeTab === 'variables' && editing ? (
        <EditPanel
          occurrence={editing}
          variables={payload.variables}
          busy={busy}
          onCancel={() => setEditing(null)}
          onApply={apply}
        />
      ) : null}
      <ResizeGrip size={windowSize} onSize={setWindowSize} />
    </div>
  )
}

function ResizeGrip({
  size,
  onSize,
}: {
  size: WindowSize
  onSize: (size: WindowSize) => void
}) {
  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const origin = { x: event.clientX, y: event.clientY, ...size }
    const target = event.currentTarget

    const move = (moveEvent: PointerEvent) => {
      const next = {
        width: origin.width + moveEvent.clientX - origin.x,
        height: origin.height + moveEvent.clientY - origin.y,
      }
      onSize(next)
      send({ type: 'RESIZE', size: next })
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }

  return <div className="resize-grip" onPointerDown={pointerDown} aria-hidden="true" />
}
