// Import wizard (B8). Fetches JSON from a source site, lets the GM pick which
// array of records to use and map its keys onto an entity kind's fields, previews
// the result, and imports. Generic so it works against any GitHub-hosted JSON.

import { useEffect, useMemo, useState } from 'react'
import { httpImport } from '../adapters/httpImport'
import type { EntityKind } from '../store/entities'
import {
  arrayKeysOf,
  importEntities,
  keysOf,
  recordsFrom,
  type FieldMap,
  type ImportResult,
} from '../store/importing'

const KIND_OPTIONS: { value: EntityKind; label: string }[] = [
  { value: 'pc', label: 'Characters' },
  { value: 'npc', label: 'NPCs' },
  { value: 'location', label: 'Locations' },
  { value: 'misc', label: 'Misc' },
]

export function ImportDialog({
  url,
  label,
  campaignId,
  onClose,
  onDone,
}: {
  url: string
  label: string
  campaignId: string
  onClose: () => void
  onDone: (r: ImportResult) => void
}) {
  const [phase, setPhase] = useState<'loading' | 'configure' | 'importing'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [json, setJson] = useState<unknown>(null)
  const [arrayKey, setArrayKey] = useState('') // '' = the top-level value is the array
  const [kind, setKind] = useState<EntityKind>('npc')
  const [map, setMap] = useState<FieldMap>({ name: '' })
  const [miscKind, setMiscKind] = useState('imported')

  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    setError(null)
    httpImport
      .fetch(url)
      .then((data) => {
        if (cancelled) return
        setJson(data)
        setArrayKey(Array.isArray(data) ? '' : arrayKeysOf(data)[0] ?? '')
        setPhase('configure')
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Could not fetch the source.')
        setPhase('configure')
      })
    return () => {
      cancelled = true
    }
  }, [url])

  const arrayKeys = useMemo(() => arrayKeysOf(json), [json])
  const records = useMemo(() => recordsFrom(json, arrayKey || undefined), [json, arrayKey])
  const keys = useMemo(() => keysOf(records), [records])

  // Keep the name mapping valid: pick a likely key on first load and whenever the
  // chosen record set changes out from under the current selection.
  useEffect(() => {
    if (!keys.length) return
    setMap((m) =>
      m.name && keys.includes(m.name)
        ? m
        : { ...m, name: keys.find((k) => /name|title|label/i.test(k)) ?? keys[0] },
    )
  }, [keys])

  const countOf = (k: string): number => {
    const v = (json as Record<string, unknown>)?.[k]
    return Array.isArray(v) ? v.length : 0
  }

  async function run() {
    if (!map.name || records.length === 0) return
    setPhase('importing')
    setError(null)
    try {
      const result = await importEntities(campaignId, kind, records, kind === 'misc' ? { ...map, miscKind } : map)
      onDone(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
      setPhase('configure')
    }
  }

  const sample = records
    .slice(0, 5)
    .map((r) => (map.name ? String(r[map.name] ?? '').trim() : ''))
    .filter(Boolean)

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal import-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 style={{ marginTop: 0 }}>Import from {label}</h2>

        {phase === 'loading' ? (
          <p className="muted">Fetching {url}…</p>
        ) : (
          <>
            {arrayKeys.length > 0 && (
              <div className="field">
                <label>Records list</label>
                <select value={arrayKey} onChange={(e) => setArrayKey(e.target.value)}>
                  {arrayKeys.map((k) => (
                    <option key={k} value={k}>
                      {k} ({countOf(k)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <p className="muted" style={{ marginTop: 0 }}>
              {records.length} record(s){sample.length ? ` · e.g. ${sample.join(', ')}` : ''}.
            </p>

            <div className="field">
              <label>Import as</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as EntityKind)}>
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {kind === 'misc' && (
              <div className="field">
                <label>Misc kind</label>
                <input value={miscKind} onChange={(e) => setMiscKind(e.target.value)} placeholder="e.g. faction" />
              </div>
            )}

            <MapRow label="Name *" value={map.name} keys={keys} onChange={(v) => setMap((m) => ({ ...m, name: v }))} />
            <MapRow
              label="Tags"
              value={map.tags}
              keys={keys}
              optional
              onChange={(v) => setMap((m) => ({ ...m, tags: v || undefined }))}
            />
            {kind !== 'misc' && (
              <MapRow
                label={kind === 'location' ? 'Image' : 'Portrait'}
                value={map.image}
                keys={keys}
                optional
                onChange={(v) => setMap((m) => ({ ...m, image: v || undefined }))}
              />
            )}
            <MapRow
              label={kind === 'location' ? 'Description' : kind === 'misc' ? 'Body' : 'Notes'}
              value={map.body}
              keys={keys}
              optional
              onChange={(v) => setMap((m) => ({ ...m, body: v || undefined }))}
            />

            {error && <p className="image-field-error">{error}</p>}

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button onClick={onClose}>Cancel</button>
              <button
                className="primary"
                onClick={() => void run()}
                disabled={!map.name || records.length === 0 || phase === 'importing'}
              >
                {phase === 'importing' ? 'Importing…' : `Import ${records.length}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MapRow({
  label,
  value,
  keys,
  onChange,
  optional,
}: {
  label: string
  value?: string
  keys: string[]
  onChange: (v: string) => void
  optional?: boolean
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {optional && <option value="">— none —</option>}
        {keys.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
    </div>
  )
}
