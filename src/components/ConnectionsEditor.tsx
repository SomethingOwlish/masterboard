// In-drawer relation editor (B4). Shows every relation touching this entity and
// lets the GM add one to another PC/NPC with a label and direction. Backed by the
// shared relations store, so edits appear instantly on the Relation board too.

import { useState } from 'react'
import { KIND_GLYPH, type EntityRef } from '../store/entities'
import { useRelations } from '../store/relations'

export type { EntityRef }

export function ConnectionsEditor({ entityId, entities }: { entityId: string; entities: EntityRef[] }) {
  const relations = useRelations((s) => s.relations)
  const addRelation = useRelations((s) => s.addRelation)
  const updateRelation = useRelations((s) => s.updateRelation)
  const removeRelation = useRelations((s) => s.removeRelation)

  const [toId, setToId] = useState('')
  const [label, setLabel] = useState('')
  const [directed, setDirected] = useState(false)

  const entityOf = (id: string) => entities.find((e) => e.id === id)
  const nameOf = (id: string) => {
    const e = entityOf(id)
    return e ? `${KIND_GLYPH[e.kind]} ${e.name}` : '(unknown)'
  }
  const mine = relations.filter((r) => r.fromId === entityId || r.toId === entityId)
  const targets = entities.filter((e) => e.id !== entityId)

  function add() {
    if (!toId) return
    void addRelation({ fromId: entityId, toId, label: label.trim(), directed })
    setToId('')
    setLabel('')
    setDirected(false)
  }

  return (
    <div>
      {mine.length === 0 ? (
        <p className="muted" style={{ margin: '0 0 0.5rem' }}>No connections yet.</p>
      ) : (
        <ul className="conn-list">
          {mine.map((r) => {
            const other = r.fromId === entityId ? r.toId : r.fromId
            const outgoing = r.fromId === entityId
            return (
              <li key={r.id} className="conn-item">
                <span aria-hidden>{r.directed ? (outgoing ? '→' : '←') : '↔'}</span>
                <strong>{nameOf(other)}</strong>
                <input
                  className="conn-label"
                  value={r.label}
                  placeholder="label"
                  onChange={(e) => void updateRelation(r.id, { label: e.target.value })}
                />
                <button className="ghost" aria-label="Remove connection" onClick={() => void removeRelation(r.id)}>
                  🗑
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {targets.length > 0 && (
        <div className="conn-add">
          <select value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">Link to…</option>
            {targets.map((e) => (
              <option key={e.id} value={e.id}>
                {KIND_GLYPH[e.kind]} {e.name || '(unnamed)'}
              </option>
            ))}
          </select>
          <input value={label} placeholder="label (e.g. rival)" onChange={(e) => setLabel(e.target.value)} />
          <label className="row" style={{ gap: '0.3rem', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={directed} onChange={(e) => setDirected(e.target.checked)} /> directed
          </label>
          <button onClick={add} disabled={!toId}>
            Link
          </button>
        </div>
      )}
    </div>
  )
}
