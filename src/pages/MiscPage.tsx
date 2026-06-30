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
import { useFocusParam, useNewAction } from '../lib/shortcuts'
import { useCampaign } from '../store/campaign'
import { useEntityPool } from '../store/entities'
import { useMisc } from '../store/misc'
import { useConfirm } from '../components/useConfirm'
import { Icon, Button, TextField, Select } from '../ds'

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
  const confirm = useConfirm()

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

  useFocusParam(setOpenId)
  // `n` creates in the first kind so the shortcut works without a kind picker.
  useNewAction(() => void create(kinds[0] ?? 'note'))

  function addKind() {
    const name = window.prompt('New kind name (e.g. faction, item, rumor):')?.trim()
    if (!name || kinds.includes(name)) return
    void updateSettings({ miscKinds: [...kinds, name] })
  }

  const defaultKind = kinds[0] ?? 'note'

  return (
    <div className="content">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="row" style={{ margin: 0, gap: '0.5rem' }}>
          <Icon name="dices" size={24} /> Misc
        </h1>
        <div className="row">
          <Button icon="plus" onClick={addKind}>Kind</Button>
          <Button variant="primary" icon="plus" onClick={() => void create(defaultKind)}>
            New object
          </Button>
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
                <Button variant="ghost" size="sm" icon="plus" onClick={() => void create(kind)}>Add {kind}</Button>
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
              <Button
                variant="ghost"
                tone="danger"
                icon="trash-2"
                onClick={() =>
                  confirm({
                    title: 'Delete object?',
                    message: `Delete "${editing.name || 'this object'}"? This cannot be undone.`,
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
          <Select
            label="Kind"
            value={editing.kind}
            onChange={(e) => void update(editing.id, { kind: e.target.value })}
          >
            {[...new Set([...kinds, editing.kind])].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </Select>
          <TextField
            label="Body"
            multiline
            rows={4}
            value={editing.body ?? ''}
            onChange={(e) => void update(editing.id, { body: e.target.value || undefined })}
          />

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
