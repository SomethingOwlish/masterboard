// Session-recap log (M2): reverse-chronological prose record of past sessions —
// the campaign's chronology as notes. Add / edit / delete; each entry carries an
// auto-incrementing sequence number.

import { useState } from 'react'
import type { SessionRecap } from '../model/types'
import { useCampaign } from '../store/campaign'
import { useConfirm } from './useConfirm'
import { Icon, Button, RecapItem } from '../ds'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function RecapLog({ recaps }: { recaps: SessionRecap[] }) {
  const { addRecap, editRecap, deleteRecap } = useCampaign()
  const confirm = useConfirm()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [realDate, setRealDate] = useState(today())
  const [body, setBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const reset = () => {
    setTitle('')
    setRealDate(today())
    setBody('')
    setAdding(false)
  }

  const submit = async () => {
    if (!title.trim()) return
    await addRecap({ title: title.trim(), realDate, body: body.trim() })
    reset()
  }

  const sorted = [...recaps].sort((a, b) => (a.realDate < b.realDate ? 1 : -1))

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section-title row" style={{ margin: 0, gap: '0.4rem' }}><Icon name="scroll-text" size={18} /> Session recaps</h2>
        {!adding && <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Add recap</Button>}
      </div>

      {adding && (
        <div className="card" style={{ marginTop: '0.75rem', background: 'var(--surface-2)' }}>
          <div className="row" style={{ gap: '0.6rem', alignItems: 'flex-start' }}>
            <div className="field" style={{ flex: 2 }}>
              <label htmlFor="r-title">Title</label>
              <input id="r-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The fall of Greenrest" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="r-date">Date played</label>
              <input id="r-date" type="date" value={realDate} onChange={(e) => setRealDate(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="r-body">What happened</label>
            <textarea id="r-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={reset}>Cancel</Button>
            <Button variant="primary" onClick={submit} disabled={!title.trim()}>Save recap</Button>
          </div>
        </div>
      )}

      {sorted.length === 0 && !adding && (
        <p className="muted" style={{ marginBottom: 0 }}>No recaps yet. Log a session after you play it.</p>
      )}

      <ol className="recap-list">
        {sorted.map((r) =>
          editingId === r.id ? (
            <RecapEditor
              key={r.id}
              recap={r}
              onSave={async (patch) => {
                await editRecap(r.id, patch)
                setEditingId(null)
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <li key={r.id}>
              <RecapItem seq={r.seq} date={r.realDate} title={r.title} body={r.body} />
              <div className="row" style={{ marginTop: '0.4rem' }}>
                <Button size="sm" variant="ghost" icon="pencil" onClick={() => setEditingId(r.id)}>Edit</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  tone="danger"
                  icon="trash-2"
                  onClick={() =>
                    confirm({
                      title: 'Delete recap?',
                      message: `Delete "${r.title}"? This cannot be undone.`,
                      confirmLabel: 'Delete',
                      onConfirm: () => void deleteRecap(r.id),
                    })
                  }
                >
                  Delete
                </Button>
              </div>
            </li>
          ),
        )}
      </ol>
    </section>
  )
}

function RecapEditor({
  recap,
  onSave,
  onCancel,
}: {
  recap: SessionRecap
  onSave: (patch: Partial<SessionRecap>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(recap.title)
  const [realDate, setRealDate] = useState(recap.realDate)
  const [body, setBody] = useState(recap.body)

  return (
    <li className="recap-item" style={{ background: 'var(--surface-2)' }}>
      <div className="row" style={{ gap: '0.6rem', alignItems: 'flex-start' }}>
        <div className="field" style={{ flex: 2 }}>
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Date played</label>
          <input type="date" value={realDate} onChange={(e) => setRealDate(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>What happened</label>
        <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button onClick={onCancel}>Cancel</button>
        <button className="primary" onClick={() => onSave({ title: title.trim(), realDate, body: body.trim() })}>
          Save
        </button>
      </div>
    </li>
  )
}
