import { useMemo, useState, type ReactNode } from 'react'
import { DIFF_CATEGORIES } from '../../shared/diff'
import type {
  ComponentPropertyDifference,
  DiffCategory,
  DiffScanPayload,
  DiffValue,
  LayerFieldDifference,
} from '../../shared/types'
import { send } from '../messaging'

export function DiffPanel({ payload }: { payload: DiffScanPayload | null }) {
  const [search, setSearch] = useState('')
  const [categories, setCategories] = useState<Set<DiffCategory>>(new Set())

  const filtered = useMemo(() => {
    if (!payload) return []
    const query = search.trim().toLowerCase()
    const categoryAllowed = (category: DiffCategory) =>
      categories.size === 0 || categories.has(category)

    return payload.instances
      .map((instance) => {
        const componentProperties = categoryAllowed('component-properties')
          ? instance.componentProperties.filter((difference) =>
              matchesComponentProperty(difference, query, instance.instanceName),
            )
          : []
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
          componentProperties,
          layers,
          visibleCount:
            componentProperties.length +
            layers.reduce((total, layer) => total + layer.differences.length, 0),
        }
      })
      .filter((instance) => instance.visibleCount > 0)
  }, [categories, payload, search])

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
    <>
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
          <DiffEmpty title="No direct overrides." body={`${payload.unchangedInstanceCount} unchanged instance${payload.unchangedInstanceCount === 1 ? '' : 's'} found.`} />
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

              {instance.componentProperties.length > 0 ? (
                <CollapsibleDetails className="diff-layer">
                  <summary>
                    <span>
                      <strong>Component properties</strong>
                      <small>{instance.componentProperties.length} changed</small>
                    </span>
                  </summary>
                  {instance.componentProperties.map((difference) => (
                    <DifferenceRow
                      key={difference.id}
                      label={difference.propertyName}
                      rawLabel={`${difference.propertyType} · ${difference.propertyKey}`}
                      original={difference.original}
                      current={difference.current}
                      onNavigate={() => send({ type: 'NAVIGATE_DIFF', nodeId: instance.instanceId })}
                    />
                  ))}
                </CollapsibleDetails>
              ) : null}

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
                      mapping={difference.mapping}
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
      <footer className="statusbar">
        <span>{payload.instances.length} changed instances</span>
        <span>{payload.unchangedInstanceCount} unchanged hidden</span>
      </footer>
    </>
  )
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
  mapping,
  onNavigate,
}: {
  label: string
  rawLabel: string
  original: DiffValue
  current: DiffValue
  mapping?: LayerFieldDifference['mapping']
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
      {mapping === 'unavailable' ? (
        <div className="mapping-warning">Original layer mapping unavailable; the override is still reported by Figma.</div>
      ) : null}
      {(original.kind === 'complex' || current.kind === 'complex') ? (
        <details className="raw-details">
          <summary>Raw details</summary>
          <div className="raw-grid">
            <pre>{original.detail || 'Unavailable'}</pre>
            <pre>{current.detail || 'Unavailable'}</pre>
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

function matchesComponentProperty(
  difference: ComponentPropertyDifference,
  query: string,
  instanceName: string,
): boolean {
  if (!query) return true
  return [
    instanceName,
    difference.propertyName,
    difference.propertyKey,
    difference.propertyType,
    difference.original.preview,
    difference.current.preview,
  ]
    .join(' ')
    .toLowerCase()
    .includes(query)
}

function matchesLayerDifference(
  difference: LayerFieldDifference,
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
  ]
    .join(' ')
    .toLowerCase()
    .includes(query)
}
