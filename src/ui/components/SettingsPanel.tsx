import { useMemo, useState } from 'react'
import type { ScanPayload, SharedSettingsV1 } from '../../shared/types'

type Props = {
  payload: ScanPayload
  busy: boolean
  onClose: () => void
  onSave: (settings: SharedSettingsV1) => void
}

export function SettingsPanel({ payload, busy, onClose, onSave }: Props) {
  const [search, setSearch] = useState('')
  const [settings, setSettings] = useState<SharedSettingsV1>(() => ({
    version: 1,
    excludedCollectionIds: [...payload.settings.excludedCollectionIds],
    excludedGroups: payload.settings.excludedGroups.map((rule) => ({ ...rule })),
  }))

  const visibleCollections = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return payload.settingsTree
    return payload.settingsTree
      .map((collection) => ({
        ...collection,
        groups: collection.groups.filter((group) =>
          `${collection.name}/${group.path}`.toLowerCase().includes(query),
        ),
      }))
      .filter(
        (collection) =>
          collection.name.toLowerCase().includes(query) || collection.groups.length > 0,
      )
  }, [payload.settingsTree, search])

  const excludedCount =
    settings.excludedCollectionIds.length + settings.excludedGroups.length

  function toggleCollection(collectionId: string) {
    setSettings((current) => ({
      ...current,
      excludedCollectionIds: current.excludedCollectionIds.includes(collectionId)
        ? current.excludedCollectionIds.filter((id) => id !== collectionId)
        : [...current.excludedCollectionIds, collectionId],
    }))
  }

  function toggleGroup(collectionId: string, prefix: string) {
    setSettings((current) => {
      const exists = current.excludedGroups.some(
        (rule) => rule.collectionId === collectionId && rule.prefix === prefix,
      )
      return {
        ...current,
        excludedGroups: exists
          ? current.excludedGroups.filter(
              (rule) => !(rule.collectionId === collectionId && rule.prefix === prefix),
            )
          : [...current.excludedGroups, { collectionId, prefix }],
      }
    })
  }

  return (
    <div className="settings-screen">
      <header className="screen-header">
        <div>
          <div className="eyebrow">Shared file settings</div>
          <h1>Picker exclusions</h1>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close settings">
          x
        </button>
      </header>
      <p className="settings-intro">
        Excluded collections and slash-delimited groups remain visible in scan results, but are
        removed from variable selection lists for everyone using this plugin in the file.
      </p>
      <label className="search-field settings-search">
        <span aria-hidden="true">/</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search collections and groups"
        />
      </label>

      <div className="settings-list">
        {visibleCollections.map((collection) => {
          const collectionExcluded = settings.excludedCollectionIds.includes(collection.id)
          const matchingRules = settings.excludedGroups.filter(
            (rule) => rule.collectionId === collection.id,
          )
          return (
            <section className="settings-collection" key={collection.id}>
              <label className="check-row collection-row">
                <input
                  type="checkbox"
                  checked={collectionExcluded}
                  ref={(element) => {
                    if (element) {
                      element.indeterminate = !collectionExcluded && matchingRules.length > 0
                    }
                  }}
                  onChange={() => toggleCollection(collection.id)}
                />
                <span>
                  <strong>{collection.name}</strong>
                  <small>{collection.variableCount} variables</small>
                </span>
              </label>
              {!collectionExcluded
                ? collection.groups.map((group) => (
                    <label
                      className="check-row group-row"
                      style={{ paddingLeft: `${20 + Math.max(0, group.path.split('/').length - 1) * 14}px` }}
                      key={group.path}
                    >
                      <input
                        type="checkbox"
                        checked={settings.excludedGroups.some(
                          (rule) =>
                            rule.collectionId === collection.id && rule.prefix === group.path,
                        )}
                        onChange={() => toggleGroup(collection.id, group.path)}
                      />
                      <span>
                        <strong>{group.path}</strong>
                        <small>{group.variableCount} variables including descendants</small>
                      </span>
                    </label>
                  ))
                : null}
            </section>
          )
        })}
      </div>

      <footer className="settings-footer">
        <button
          type="button"
          className="button ghost"
          onClick={() =>
            setSettings({ version: 1, excludedCollectionIds: [], excludedGroups: [] })
          }
        >
          Reset all
        </button>
        <span className="settings-count">{excludedCount} exclusion rules</span>
        <button
          type="button"
          className="button primary"
          disabled={busy}
          onClick={() => onSave(settings)}
        >
          {busy ? 'Saving...' : 'Save settings'}
        </button>
      </footer>
    </div>
  )
}

