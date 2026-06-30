// Locations module (M8 / B6): places & maps. Card grid + a detail drawer with
// name, description, image, tags, and cross-module connections. Back-links ("who
// references this location") surface through the shared relation graph, so the
// Connections editor shows them alongside outgoing links.

import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useFocusParam, useNewAction } from '../lib/shortcuts'
import { Drawer } from '../components/Drawer'
import { TagEditor } from '../components/TagEditor'
import { ConnectionsEditor } from '../components/ConnectionsEditor'
import { ImageField } from '../components/ImageField'
import { EntityTaskButton } from '../components/EntityTaskButton'
import { makeLocation } from '../model/defaults'
import { useEntityPool } from '../store/entities'
import { useLocations } from '../store/locations'
import { useConfirm } from '../components/useConfirm'
import { Icon, Button, TextField, Select, EmptyState } from '../ds'

export function LocationsPage() {
  const { campaignId } = useParams()
  const locations = useLocations((s) => s.locations)
  const loading = useLocations((s) => s.loading)
  const add = useLocations((s) => s.add)
  const update = useLocations((s) => s.update)
  const remove = useLocations((s) => s.remove)

  const entities = useEntityPool(campaignId)

  const [openId, setOpenId] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState('')
  const confirm = useConfirm()

  const editing = locations.find((l) => l.id === openId) ?? null
  const allTags = useMemo(() => [...new Set(locations.flatMap((l) => l.tags))].sort(), [locations])
  const shown = locations.filter((l) => !tagFilter || l.tags.includes(tagFilter))

  async function create() {
    const l = makeLocation()
    await add(l)
    setOpenId(l.id)
  }

  useFocusParam(setOpenId)
  useNewAction(() => void create())

  return (
    <div className="content">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="row" style={{ margin: 0, gap: '0.5rem' }}>
          <Icon name="map-pin" size={24} /> Locations
        </h1>
        <Button variant="primary" icon="plus" onClick={() => void create()}>
          New location
        </Button>
      </div>

      {allTags.length > 0 && (
        <div className="row" style={{ marginTop: '0.75rem' }}>
          <Select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} containerStyle={{ minWidth: 160 }}>
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
      )}

      {loading ? (
        <p className="muted" style={{ marginTop: '1rem' }}>Loading…</p>
      ) : shown.length === 0 ? (
        <EmptyState
          icon="map-pin"
          title={locations.length === 0 ? 'No locations yet' : 'No locations match the current filter'}
          hint={locations.length === 0 ? 'Add one with “New location”.' : 'Try a different tag.'}
          action={locations.length === 0 ? <Button variant="primary" icon="plus" onClick={() => void create()}>New location</Button> : undefined}
          style={{ marginTop: '1rem' }}
        />
      ) : (
        <div className="grid entity-grid" style={{ marginTop: '1rem' }}>
          {shown.map((l) => (
            <button key={l.id} className="card entity-card" onClick={() => setOpenId(l.id)}>
              {l.image ? (
                <img className="loc-thumb" src={l.image} alt="" />
              ) : (
                <span className="loc-thumb loc-thumb-empty" aria-hidden><Icon name="map-pin" size={28} /></span>
              )}
              <strong>{l.name || '(unnamed)'}</strong>
              {l.description && <p className="muted entity-snippet">{l.description}</p>}
              {l.tags.length > 0 && (
                <div className="chips">
                  {l.tags.map((t) => (
                    <span key={t} className="chip">{t}</span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {editing && (
        <Drawer
          title={editing.name || 'New location'}
          onClose={() => setOpenId(null)}
          footer={
            <>
              <Button
                variant="ghost"
                tone="danger"
                icon="trash-2"
                onClick={() =>
                  confirm({
                    title: 'Delete location?',
                    message: `Delete "${editing.name || 'this location'}"? This cannot be undone.`,
                    confirmLabel: 'Delete',
                    onConfirm: () => {
                      void remove(editing.id)
                      setOpenId(null)
                    },
                  })
                }
              >
                Delete
              </Button>
              <Button variant="primary" onClick={() => setOpenId(null)}>
                Done
              </Button>
            </>
          }
        >
          <TextField
            label="Name"
            value={editing.name}
            onChange={(e) => void update(editing.id, { name: e.target.value })}
          />
          <TextField
            label="Description"
            multiline
            rows={4}
            value={editing.description ?? ''}
            onChange={(e) => void update(editing.id, { description: e.target.value || undefined })}
          />
          <div className="field">
            <label>Image</label>
            <ImageField
              value={editing.image}
              variant="thumb"
              glyph="map-pin"
              onChange={(image) => void update(editing.id, { image })}
            />
          </div>

          <h3 className="section-title">Tags</h3>
          <TagEditor tags={editing.tags} onChange={(tags) => void update(editing.id, { tags })} />

          <h3 className="section-title" style={{ marginTop: '1rem' }}>Connections</h3>
          <ConnectionsEditor entityId={editing.id} entities={entities} />

          <h3 className="section-title" style={{ marginTop: '1rem' }}>Tasks</h3>
          <EntityTaskButton campaignId={campaignId} entityId={editing.id} entityName={editing.name} kind="location" />
        </Drawer>
      )}
    </div>
  )
}
