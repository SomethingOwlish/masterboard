// NPC board (M4 / B3): like Characters, plus a Dead toggle (dead → greyed + skull)
// and filtering by tag and alive/dead state.

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Drawer } from '../components/Drawer'
import { FieldsEditor } from '../components/FieldsEditor'
import { TagEditor } from '../components/TagEditor'
import { ConnectionsEditor, type EntityRef } from '../components/ConnectionsEditor'
import { makeNpc } from '../model/defaults'
import { useCampaign } from '../store/campaign'
import { useNpcs } from '../store/npcs'
import { useRelations } from '../store/relations'

type AliveFilter = 'all' | 'alive' | 'dead'

export function NpcsPage() {
  const { campaignId } = useParams()
  const npcs = useNpcs((s) => s.npcs)
  const loading = useNpcs((s) => s.loading)
  const loadNpcs = useNpcs((s) => s.load)
  const add = useNpcs((s) => s.add)
  const update = useNpcs((s) => s.update)
  const remove = useNpcs((s) => s.remove)

  const characters = useCampaign((s) => s.characters)
  const loadRelations = useRelations((s) => s.load)

  const [openId, setOpenId] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState('')
  const [alive, setAlive] = useState<AliveFilter>('all')

  useEffect(() => {
    if (campaignId) {
      void loadNpcs(campaignId)
      void loadRelations(campaignId)
    }
  }, [campaignId, loadNpcs, loadRelations])

  const editing = npcs.find((n) => n.id === openId) ?? null
  const entities = useMemo<EntityRef[]>(
    () => [
      ...characters.map((c) => ({ id: c.id, name: c.name })),
      ...npcs.map((n) => ({ id: n.id, name: n.name })),
    ],
    [characters, npcs],
  )
  const allTags = useMemo(() => [...new Set(npcs.flatMap((n) => n.tags))].sort(), [npcs])
  const shown = npcs.filter(
    (n) =>
      (alive === 'all' || (alive === 'dead' ? n.dead : !n.dead)) &&
      (!tagFilter || n.tags.includes(tagFilter)),
  )

  async function create() {
    const n = makeNpc()
    await add(n)
    setOpenId(n.id)
  }

  return (
    <div className="content">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>
          <span aria-hidden>🎭</span> NPCs
        </h1>
        <button className="primary" onClick={() => void create()}>
          + New NPC
        </button>
      </div>

      <div className="row" style={{ marginTop: '0.75rem' }}>
        <select value={alive} onChange={(e) => setAlive(e.target.value as AliveFilter)}>
          <option value="all">All</option>
          <option value="alive">Alive</option>
          <option value="dead">Dead</option>
        </select>
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} disabled={allTags.length === 0}>
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="muted" style={{ marginTop: '1rem' }}>Loading…</p>
      ) : shown.length === 0 ? (
        <p className="muted" style={{ marginTop: '1rem' }}>
          {npcs.length === 0 ? 'No NPCs yet. Add one with “New NPC”.' : 'No NPCs match the current filters.'}
        </p>
      ) : (
        <div className="grid entity-grid" style={{ marginTop: '1rem' }}>
          {shown.map((n) => (
            <button key={n.id} className={`card entity-card ${n.dead ? 'is-dead' : ''}`} onClick={() => setOpenId(n.id)}>
              <div className="entity-head">
                {n.portrait ? (
                  <img className="avatar" src={n.portrait} alt="" />
                ) : (
                  <span className="avatar avatar-empty" aria-hidden>{n.dead ? '💀' : '🎭'}</span>
                )}
                <div className="entity-title">
                  <strong>{n.name || '(unnamed)'}</strong>
                  {n.dead && <div className="muted">💀 Dead</div>}
                </div>
              </div>
              {n.tags.length > 0 && (
                <div className="chips">
                  {n.tags.map((t) => (
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
          title={editing.name || 'New NPC'}
          onClose={() => setOpenId(null)}
          footer={
            <>
              <button
                onClick={() => {
                  void remove(editing.id)
                  setOpenId(null)
                }}
              >
                Delete
              </button>
              <button className="primary" onClick={() => setOpenId(null)}>
                Done
              </button>
            </>
          }
        >
          <div className="field">
            <label>Name</label>
            <input value={editing.name} onChange={(e) => void update(editing.id, { name: e.target.value })} />
          </div>
          <label className="row" style={{ gap: '0.4rem', marginBottom: '0.75rem' }}>
            <input type="checkbox" checked={editing.dead} onChange={(e) => void update(editing.id, { dead: e.target.checked })} />
            Dead
          </label>
          <div className="field">
            <label>Portrait URL</label>
            <input
              value={editing.portrait ?? ''}
              placeholder="https://… (Imgur upload arrives in B7)"
              onChange={(e) => void update(editing.id, { portrait: e.target.value || undefined })}
            />
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea rows={3} value={editing.notes ?? ''} onChange={(e) => void update(editing.id, { notes: e.target.value || undefined })} />
          </div>

          <h3 className="section-title">Fields</h3>
          <FieldsEditor fields={editing.fields} onChange={(fields) => void update(editing.id, { fields })} />

          <h3 className="section-title" style={{ marginTop: '1rem' }}>Tags</h3>
          <TagEditor tags={editing.tags} onChange={(tags) => void update(editing.id, { tags })} />

          <h3 className="section-title" style={{ marginTop: '1rem' }}>Connections</h3>
          <ConnectionsEditor entityId={editing.id} entities={entities} />
        </Drawer>
      )}
    </div>
  )
}
