// Misc module (M9 / B6): flexible cards (body + fields + tags) grouped by a
// GM-defined kind (note / item / custom…). The kind list lives in
// campaign.settings.miscKinds; new kinds can be registered inline here.

import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Drawer } from '../components/Drawer'
import { FieldsEditor } from '../components/FieldsEditor'
import { TagEditor } from '../components/TagEditor'
import { ConnectionsEditor } from '../components/ConnectionsEditor'
import { EntityTaskButton } from '../components/EntityTaskButton'
import { makeMisc } from '../model/defaults'
import { useCampaign } from '../store/campaign'
import { useEntityPool } from '../store/entities'
import { useMisc } from '../store/misc'

export function MiscPage() {
  const { campaignId } = useParams()
  const misc = useMisc((s) => s.misc)
  const loading = useMisc((s) => s.loading)
  const add = useMisc((s) => s.add)
  const update = useMisc((s) => s.update)
  const remove = useMisc((s) => s.remove)

  const kinds = useCampaign((s) => s.campaign?.settings.miscKinds ?? [])
  const updateSettings = useCampaign((s) => s.updateSettings)

  const entities = useEntityPool(campaignId)

  const [openId, setOpenId] = useState<string | null>(null)

  const editing = misc.find((m) => m.id === openId) ?? null

  // Group by kind, keeping the GM's kind ordering, then any kinds only present on
  // existing objects (e.g. imported data), then the empties last.
  const groups = useMemo(() => {
    const present = [...new Set(misc.map((m) => m.kind))]
    const ordered = [...kinds, ...present.filter((k) => !kinds.includes(k))]
    return ordered.map((kind) => ({ kind, items: misc.filter((m) => m.kind === kind) }))
  }, [misc, kinds])

  async function create(kind: string) {
    const m = makeMisc(kind)
    await add(m)
    setOpenId(m.id)
  }

  function addKind() {
    const name = window.prompt('New kind name (e.g. faction, item, rumor):')?.trim()
    if (!name || kinds.includes(name)) return
    void updateSettings({ miscKinds: [...kinds, name] })
  }

  const defaultKind = kinds[0] ?? 'note'

  return (
    <div className="content">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>
          <span aria-hidden>🎲</span> Misc
        </h1>
        <div className="row">
          <button onClick={addKind}>+ Kind</button>
          <button className="primary" onClick={() => void create(defaultKind)}>
            + New object
          </button>
        </div>
      </div>

      {loading ? (
        <p className="muted" style={{ marginTop: '1rem' }}>Loading…</p>
      ) : (
        <div className="misc-groups">
          {groups.map(({ kind, items }) => (
            <section key={kind} className="misc-group">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2 className="misc-group-title">{kind}</h2>
                <button className="ghost" onClick={() => void create(kind)}>+ Add {kind}</button>
              </div>
              {items.length === 0 ? (
                <p className="muted" style={{ fontSize: '0.85rem' }}>No {kind} objects yet.</p>
              ) : (
                <div className="grid entity-grid">
                  {items.map((m) => (
                    <button key={m.id} className="card entity-card" onClick={() => setOpenId(m.id)}>
                      <strong>{m.name || '(unnamed)'}</strong>
                      {m.body && <p className="muted entity-snippet">{m.body}</p>}
                      {m.tags.length > 0 && (
                        <div className="chips">
                          {m.tags.map((t) => (
                            <span key={t} className="chip">{t}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {editing && (
        <Drawer
          title={editing.name || 'New object'}
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
          <div className="field">
            <label>Kind</label>
            <select value={editing.kind} onChange={(e) => void update(editing.id, { kind: e.target.value })}>
              {[...new Set([...kinds, editing.kind])].map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Body</label>
            <textarea
              rows={4}
              value={editing.body ?? ''}
              onChange={(e) => void update(editing.id, { body: e.target.value || undefined })}
            />
          </div>

          <h3 className="section-title">Fields</h3>
          <FieldsEditor fields={editing.fields} onChange={(fields) => void update(editing.id, { fields })} />

          <h3 className="section-title" style={{ marginTop: '1rem' }}>Tags</h3>
          <TagEditor tags={editing.tags} onChange={(tags) => void update(editing.id, { tags })} />

          <h3 className="section-title" style={{ marginTop: '1rem' }}>Connections</h3>
          <ConnectionsEditor entityId={editing.id} entities={entities} />

          <h3 className="section-title" style={{ marginTop: '1rem' }}>Tasks</h3>
          <EntityTaskButton campaignId={campaignId} entityId={editing.id} entityName={editing.name} kind="misc" />
        </Drawer>
      )}
    </div>
  )
}
