import { useMemo, useState, type ReactNode } from 'react'
import { DIFF_CATEGORIES } from '../../shared/diff'
import { generateDiffCss } from '../../shared/css-generator'
import { clampDiffCodePanelHeight } from '../../shared/diff-code-preferences'
import type {
  DiffCodePreferences,
  DiffCodeScope,
  DiffCategory,
  DiffScanPayload,
  DiffValue,
  VariableProvenance,
  VisualDifference,
} from '../../shared/types'
import { send } from '../messaging'

export function DiffPanel({
  payload,
  preferences,
  onPreferences,
}: {
  payload: DiffScanPayload | null
  preferences: DiffCodePreferences
  onPreferences: (preferences: DiffCodePreferences) => void
}) {
  const [search, setSearch] = useState('')
  const [categories, setCategories] = useState<Set<DiffCategory>>(new Set())

  const filtered = useMemo(() => {
    if (!payload) return []
    const query = search.trim().toLowerCase()
    const categoryAllowed = (category: DiffCategory) =>
      categories.size === 0 || categories.has(category)

    return payload.instances
      .map((instance) => {
        const layers = instance.layers
          .map((layer) => ({
            ...layer,
            differences: layer.differences.filter(
              (difference) =>
                categoryAllowed(difference.category) &&
                matchesLayerDifference(difference, query, instance.instanceName),
            ),
          }))
          .filter((layer) => layer.differences.length > 0)
        return {
          ...instance,
          layers,
          visibleCount: layers.reduce(
            (total, layer) => total + layer.differences.length,
            0,
          ),
        }
      })
      .filter((instance) => instance.visibleCount > 0)
  }, [categories, payload, search])
  const css = useMemo(
    () =>
      generateDiffCss({
        instances: filtered,
        activeCategories: categories,
        scope: preferences.scope,
      }),
    [categories, filtered, preferences.scope],
  )

  if (!payload) {
    return <div className="loading">Comparing selected instances...</div>
  }

  function toggleCategory(category: DiffCategory) {
    setCategories((current) => {
      const next = new Set(current)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  return (
    <div className="diff-panel-shell">
      <label className="search-field main-search">
        <span aria-hidden="true">/</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search instances, layers, or fields"
        />
      </label>
      <div className="category-filters" aria-label="Difference categories">
        {DIFF_CATEGORIES.map((category) => (
          <button
            type="button"
            key={category.id}
            className={categories.has(category.id) ? 'active' : ''}
            onClick={() => toggleCategory(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>
      <main className="content diff-content">
        {payload.roots.length === 0 ? (
          <DiffEmpty title="Select one or more layers." body="The Diff tab searches selected roots and all descendants for instances." />
        ) : payload.discoveredInstanceCount === 0 ? (
          <DiffEmpty title="No instances found." body="Select an instance or a frame, group, or component containing instances." />
        ) : payload.instances.length === 0 ? (
          <DiffEmpty title="No visible differences." body={`${payload.unchangedInstanceCount} visually unchanged instance${payload.unchangedInstanceCount === 1 ? '' : 's'} found.`} />
        ) : filtered.length === 0 ? (
          <DiffEmpty title="No differences match." body="Clear the search or category filters." compact />
        ) : (
          filtered.map((instance) => (
            <CollapsibleDetails className="diff-instance" key={instance.instanceId}>
              <summary>
                <span>
                  <strong>{instance.instanceName}</strong>
                  <small>{instance.instancePath.join(' / ')}</small>
                </span>
                <span className="diff-count">{instance.visibleCount}</span>
              </summary>
              <div className="diff-component-meta">
                <span>Original</span>
                <strong>{instance.mainComponentName}</strong>
                {instance.mainComponentRemote ? <span className="badge">Library</span> : null}
              </div>

              {instance.layers.map((layer) => (
                <CollapsibleDetails className="diff-layer" key={layer.nodeId}>
                  <summary>
                    <span>
                      <strong>{layer.nodeName}</strong>
                      <small>{layer.nodePath.join(' / ')}</small>
                    </span>
                    <span className="diff-count">{layer.differences.length}</span>
                  </summary>
                  {layer.differences.map((difference) => (
                    <DifferenceRow
                      key={difference.id}
                      label={difference.label}
                      rawLabel={`${difference.category} · ${difference.field}`}
                      original={difference.original}
                      current={difference.current}
                      onNavigate={() =>
                        send({ type: 'NAVIGATE_DIFF', nodeId: difference.affectedNodeId })
                      }
                    />
                  ))}
                </CollapsibleDetails>
              ))}
            </CollapsibleDetails>
          ))
        )}
      </main>
      <CodePanel
        code={css}
        preferences={preferences}
        onPreferences={onPreferences}
      />
      <footer className="statusbar">
        <span>{payload.instances.length} changed instances</span>
        <span>{payload.unchangedInstanceCount} unchanged hidden</span>
      </footer>
    </div>
  )
}

function CodePanel({
  code,
  preferences,
  onPreferences,
}: {
  code: string
  preferences: DiffCodePreferences
  onPreferences: (preferences: DiffCodePreferences) => void
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = code
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  function resizeStart(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const originY = event.clientY
    const originHeight = preferences.height
    const target = event.currentTarget
    const move = (moveEvent: PointerEvent) => {
      onPreferences({
        ...preferences,
        height: clampDiffCodePanelHeight(originHeight + originY - moveEvent.clientY),
      })
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }

  return (
    <section
      className={`code-panel ${preferences.collapsed ? 'collapsed' : ''}`}
      style={preferences.collapsed ? undefined : { height: preferences.height }}
      aria-label="Generated CSS"
    >
      {!preferences.collapsed ? (
        <div className="code-resize-handle" onPointerDown={resizeStart} />
      ) : null}
      <div className="code-panel-toolbar">
        <strong>CSS</strong>
        <select
          aria-label="CSS scope"
          value={preferences.scope}
          onChange={(event) =>
            onPreferences({
              ...preferences,
              scope: event.target.value as DiffCodeScope,
            })
          }
        >
          <option value="matched-properties">Matched properties</option>
          <option value="selected-categories">Selected categories</option>
          <option value="full-layers">Full matching layers</option>
        </select>
        <button type="button" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          aria-label={preferences.collapsed ? 'Expand CSS panel' : 'Collapse CSS panel'}
          onClick={() =>
            onPreferences({ ...preferences, collapsed: !preferences.collapsed })
          }
        >
          {preferences.collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!preferences.collapsed ? (
        <pre className="code-output"><code>{highlightCss(code)}</code></pre>
      ) : null}
    </section>
  )
}

function highlightCss(code: string): ReactNode[] {
  return code.split('\n').map((line, index) => {
    let className = 'css-value'
    if (line.trim().startsWith('/*')) className = 'css-comment'
    else if (line.trim().endsWith('{') || line.trim() === '}') className = 'css-selector'
    else if (line.includes(':')) className = 'css-declaration'
    return <span className={className} key={`${index}:${line}`}>{line}{'\n'}</span>
  })
}

function CollapsibleDetails({
  className,
  children,
}: {
  className: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <details
      className={className}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      {children}
    </details>
  )
}

function DifferenceRow({
  label,
  rawLabel,
  original,
  current,
  onNavigate,
}: {
  label: string
  rawLabel: string
  original: DiffValue
  current: DiffValue
  onNavigate: () => void
}) {
  return (
    <div className="diff-row">
      <button type="button" className="diff-row-heading" onClick={onNavigate}>
        <span>
          <strong>{label}</strong>
          <small>{rawLabel}</small>
        </span>
        <span className="navigate-mark">Locate</span>
      </button>
      <div className="diff-values">
        <DiffValueView label="Original" value={original} />
        <span className="diff-arrow">→</span>
        <DiffValueView label="Instance" value={current} />
      </div>
      {(original.kind === 'complex' ||
        current.kind === 'complex' ||
        original.tokens?.length ||
        current.tokens?.length) ? (
        <details className="raw-details">
          <summary>Raw details</summary>
          <div className="raw-grid">
            <RawValue value={original} />
            <RawValue value={current} />
          </div>
        </details>
      ) : null}
    </div>
  )
}

function DiffValueView({ label, value }: { label: string; value: DiffValue }) {
  return (
    <div className="diff-value">
      <small>{label}</small>
      <span title={value.detail}>
        {value.color ? (
          <i className="swatch" style={{ background: value.preview }} aria-hidden="true" />
        ) : null}
        {value.preview}
      </span>
      {value.tokens?.map((token) => (
        <TokenLabel key={`${token.variableId}:${token.modeId}`} token={token} />
      ))}
    </div>
  )
}

function TokenLabel({ token }: { token: VariableProvenance }) {
  return (
    <span className={`token-label ${token.status !== 'resolved' ? 'token-warning' : ''}`}>
      {token.collectionName} / {token.variableName}
    </span>
  )
}

function RawValue({ value }: { value: DiffValue }) {
  return (
    <div className="raw-value">
      <pre>{value.detail || 'Unavailable'}</pre>
      {value.tokens?.map((token) => (
        <div className="token-detail" key={`${token.variableId}:${token.modeId}`}>
          <strong>
            {token.collectionName} / {token.variableName}
          </strong>
          <span>
            {token.modeName} · {token.status} · resolves to {token.resolvedPreview}
          </span>
          {token.aliasChain.length > 1 ? (
            <span>
              {token.aliasChain
                .map((step) => `${step.collectionName} / ${step.variableName} [${step.modeName}]`)
                .join(' → ')}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function DiffEmpty({
  title,
  body,
  compact = false,
}: {
  title: string
  body: string
  compact?: boolean
}) {
  return (
    <div className={`empty ${compact ? 'compact' : ''}`}>
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  )
}

function matchesLayerDifference(
  difference: VisualDifference,
  query: string,
  instanceName: string,
): boolean {
  if (!query) return true
  return [
    instanceName,
    difference.affectedNodeName,
    difference.nodePath.join(' '),
    difference.label,
    difference.field,
    difference.category,
    difference.original.preview,
    difference.current.preview,
    ...(difference.original.tokens ?? []).flatMap((token) => [
      token.collectionName,
      token.variableName,
    ]),
    ...(difference.current.tokens ?? []).flatMap((token) => [
      token.collectionName,
      token.variableName,
    ]),
  ]
    .join(' ')
    .toLowerCase()
    .includes(query)
}
