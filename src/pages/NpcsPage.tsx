// NPC board (M4 / B3): like Characters, plus a Dead toggle (dead → greyed + skull)
// and filtering by tag and alive/dead state.

import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Drawer } from '../components/Drawer'
import { FieldsEditor } from '../components/FieldsEditor'
import { TagEditor } from '../components/TagEditor'
import { ConnectionsEditor } from '../components/ConnectionsEditor'
import { ImageField } from '../components/ImageField'
import { EntityTaskButton } from '../components/EntityTaskButton'
import { makeNpc } from '../model/defaults'
import { useFocusParam, useNewAction } from '../lib/shortcuts'
import { useNpcs } from '../store/npcs'
import { useEntityPool } from '../store/entities'
import { useConfirm } from '../components/useConfirm'
import { Icon, Button, TextField, Select, Checkbox, EntityCard, EmptyState, Tabs } from '../ds'

type AliveFilter = 'all' | 'alive' | 'dead'

export function NpcsPage() {
  const { campaignId } = useParams()
  const npcs = useNpcs((s) => s.npcs)
  const loading = useNpcs((s) => s.loading)
  const add = useNpcs((s) => s.add)
  const update = useNpcs((s) => s.update)
  const remove = useNpcs((s) => s.remove)

  const [openId, setOpenId] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState('')
  const [alive, setAlive] = useState<AliveFilter>('all')
  const confirm = useConfirm()

  // The pool loads NPCs (+ PCs/Locations/Misc + relations) for this campaign.
  const entities = useEntityPool(campaignId)

  const editing = npcs.find((n) => n.id === openId) ?? null
  const allTags = useMemo(() => [...new Set(npcs.flatMap((n) => n.tags))].sort(), [npcs])
  const shown = npcs.filter(
    (n) =>
      (alive === 'all' || (alive === 'dead' ? n.dead : !n.dead)) &&
      (!tagFilter || n.tags.includes(tagFilter)),
  )
  const aliveCount = npcs.filter((n) => !n.dead).length
  const deadCount = npcs.filter((n) => n.dead).length

  async function create() {
    const n = makeNpc()
    await add(n)
    setOpenId(n.id)
  }

  useFocusParam(setOpenId)
  useNewAction(() => void create())

  return (
    <div className="content">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="row" style={{ margin: 0, gap: '0.5rem' }}>
          <Icon name="drama" size={24} /> NPCs
        </h1>
        <Button variant="primary" icon="plus" onClick={() => void create()}>
          New NPC
        </Button>
      </div>

      <div className="row" style={{ marginTop: '0.75rem', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Tabs
          tabs={[
            { id: 'all', label: 'All', count: npcs.length },
            { id: 'alive', label: 'Alive', count: aliveCount },
            { id: 'dead', label: 'Dead', icon: 'skull', count: deadCount },
          ]}
          activeId={alive}
          onSelect={(id) => setAlive(id as AliveFilter)}
        />
        <Select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          disabled={allTags.length === 0}
          containerStyle={{ minWidth: 160 }}
        >
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <p className="muted" style={{ marginTop: '1rem' }}>Loading…</p>
      ) : shown.length === 0 ? (
        <EmptyState
          icon="drama"
          title={npcs.length === 0 ? 'No NPCs yet' : 'No NPCs match the current filters'}
          hint={npcs.length === 0 ? 'Add the cast your party will meet.' : 'Try a different tag or alive/dead filter.'}
          action={npcs.length === 0 ? <Button variant="primary" icon="plus" onClick={() => void create()}>New NPC</Button> : undefined}
          style={{ marginTop: '1rem' }}
        />
      ) : (
        <div className="grid entity-grid" style={{ marginTop: '1rem' }}>
          {shown.map((n) => (
            <EntityCard
              key={n.id}
              kind="npc"
              name={n.name || '(unnamed)'}
              portrait={n.portrait}
              dead={n.dead}
              tags={n.tags}
              onClick={() => setOpenId(n.id)}
            />
          ))}
        </div>
      )}

      {editing && (
        <Drawer
          title={editing.name || 'New NPC'}
          onClose={() => setOpenId(null)}
          footer={
            <>
              <Button
                variant="ghost"
                tone="danger"
                icon="trash-2"
                onClick={() =>
                  confirm({
                    title: 'Delete NPC?',
                    message: `Delete "${editing.name || 'this NPC'}"? This cannot be undone.`,
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
          <Checkbox
            label="Dead"
            checked={editing.dead}
            onChange={(e) => void update(editing.id, { dead: e.target.checked })}
          />
          <div className="field">
            <label>Portrait</label>
            <ImageField
              value={editing.portrait}
              variant="avatar"
              glyph="drama"
              onChange={(portrait) => void update(editing.id, { portrait })}
            />
          </div>
          <TextField
            label="Notes"
            multiline
            rows={3}
            value={editing.notes ?? ''}
            onChange={(e) => void update(editing.id, { notes: e.target.value || undefined })}
          />

          <h3 className="section-title">Fields</h3>
          <FieldsEditor fields={editing.fields} onChange={(fields) => void update(editing.id, { fields })} />

          <h3 className="section-title" style={{ marginTop: '1rem' }}>Tags</h3>
          <TagEditor tags={editing.tags} onChange={(tags) => void update(editing.id, { tags })} />

          <h3 className="section-title" style={{ marginTop: '1rem' }}>Connections</h3>
          <ConnectionsEditor entityId={editing.id} entities={entities} />

          <h3 className="section-title" style={{ marginTop: '1rem' }}>Tasks</h3>
          <EntityTaskButton campaignId={campaignId} entityId={editing.id} entityName={editing.name} kind="npc" />
        </Drawer>
      )}
    </div>
  )
}
