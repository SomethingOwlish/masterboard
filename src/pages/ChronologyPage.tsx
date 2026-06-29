// In-world chronology (M6 / B4): horizontally-scrolling columns of dated events.
// The "Campaign" column is fixed (pinned left, undeletable). Events sort by their
// free-text date by default; drag a card within its column to override the order.

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Drawer } from '../components/Drawer'
import type { ChronoColumn, ChronoEvent } from '../model/types'
import { useChronology } from '../store/chronology'

export function ChronologyPage() {
  const { campaignId } = useParams()
  const columns = useChronology((s) => s.columns)
  const events = useChronology((s) => s.events)
  const loading = useChronology((s) => s.loading)
  const load = useChronology((s) => s.load)
  const addColumn = useChronology((s) => s.addColumn)
  const renameColumn = useChronology((s) => s.renameColumn)
  const toggleMinimize = useChronology((s) => s.toggleMinimize)
  const moveColumn = useChronology((s) => s.moveColumn)
  const removeColumn = useChronology((s) => s.removeColumn)
  const addEvent = useChronology((s) => s.addEvent)
  const updateEvent = useChronology((s) => s.updateEvent)
  const removeEvent = useChronology((s) => s.removeEvent)
  const reorderColumn = useChronology((s) => s.reorderColumn)

  const [openEventId, setOpenEventId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  useEffect(() => {
    if (campaignId) void load(campaignId)
  }, [campaignId, load])

  const sortedColumns = useMemo(() => [...columns].sort((a, b) => a.order - b.order), [columns])
  const editing = events.find((e) => e.id === openEventId) ?? null

  async function newEvent(columnId: string) {
    const before = new Set(events.map((e) => e.id))
    await addEvent({ columnId, date: '', title: '' })
    // The store generates the id; grab whichever event is new to open its drawer.
    const created = useChronology.getState().events.find((e) => !before.has(e.id))
    if (created) setOpenEventId(created.id)
  }

  function eventsOf(columnId: string): ChronoEvent[] {
    return events.filter((e) => e.columnId === columnId).sort((a, b) => a.order - b.order)
  }

  function onDropBefore(columnId: string, targetId: string | null) {
    if (!dragId) return
    const ordered = eventsOf(columnId).map((e) => e.id).filter((id) => id !== dragId)
    const at = targetId ? ordered.indexOf(targetId) : ordered.length
    ordered.splice(at === -1 ? ordered.length : at, 0, dragId)
    void reorderColumn(columnId, ordered)
    setDragId(null)
  }

  if (loading) return <div className="content"><p className="muted">Loading chronology…</p></div>

  return (
    <div className="content board-content">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>
          <span aria-hidden>📜</span> Chronology
        </h1>
        <button onClick={() => void addColumn('New column')}>+ Column</button>
      </div>

      <div className="chrono-board">
        {sortedColumns.map((col, idx) => (
          <ChronoColumnView
            key={col.id}
            col={col}
            index={idx}
            count={sortedColumns.length}
            events={eventsOf(col.id)}
            dragId={dragId}
            onRename={(name) => void renameColumn(col.id, name)}
            onToggleMinimize={() => void toggleMinimize(col.id)}
            onMove={(dir) => void moveColumn(col.id, dir)}
            onRemove={() => void removeColumn(col.id)}
            onAddEvent={() => void newEvent(col.id)}
            onOpenEvent={setOpenEventId}
            onDragStart={setDragId}
            onDropBefore={(targetId) => onDropBefore(col.id, targetId)}
          />
        ))}
      </div>

      {editing && (
        <Drawer
          title={editing.title || 'Event'}
          onClose={() => setOpenEventId(null)}
          footer={
            <>
              <button
                onClick={() => {
                  void removeEvent(editing.id)
                  setOpenEventId(null)
                }}
              >
                Delete
              </button>
              <button className="primary" onClick={() => setOpenEventId(null)}>
                Done
              </button>
            </>
          }
        >
          <div className="field">
            <label>Title</label>
            <input value={editing.title} onChange={(e) => void updateEvent(editing.id, { title: e.target.value })} />
          </div>
          <div className="field">
            <label>Date</label>
            <input
              value={editing.date}
              placeholder="e.g. 3rd of Harvest, 1024"
              onChange={(e) => void updateEvent(editing.id, { date: e.target.value })}
            />
            <small>Free-form. Default order is by this text; drag cards to override.</small>
          </div>
          <div className="field">
            <label>Column</label>
            <select value={editing.columnId} onChange={(e) => void updateEvent(editing.id, { columnId: e.target.value })}>
              {sortedColumns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea rows={5} value={editing.body ?? ''} onChange={(e) => void updateEvent(editing.id, { body: e.target.value || undefined })} />
          </div>
        </Drawer>
      )}
    </div>
  )
}

function ChronoColumnView({
  col,
  index,
  count,
  events,
  dragId,
  onRename,
  onToggleMinimize,
  onMove,
  onRemove,
  onAddEvent,
  onOpenEvent,
  onDragStart,
  onDropBefore,
}: {
  col: ChronoColumn
  index: number
  count: number
  events: ChronoEvent[]
  dragId: string | null
  onRename: (name: string) => void
  onToggleMinimize: () => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  onAddEvent: () => void
  onOpenEvent: (id: string) => void
  onDragStart: (id: string) => void
  onDropBefore: (targetId: string | null) => void
}) {
  if (col.minimized) {
    return (
      <div className="chrono-col minimized">
        <button className="chrono-col-min" onClick={onToggleMinimize} title="Expand">
          <span className="chrono-col-min-name">{col.name}</span> ⮞
        </button>
      </div>
    )
  }

  return (
    <section className={`chrono-col ${col.fixed ? 'fixed' : ''}`}>
      <header className="chrono-col-head">
        {col.fixed ? (
          <strong style={{ flex: 1 }}>{col.name}</strong>
        ) : (
          <input className="chrono-col-name" value={col.name} onChange={(e) => onRename(e.target.value)} />
        )}
        <div className="chrono-col-actions">
          {!col.fixed && (
            <>
              <button className="ghost" title="Move left" disabled={index <= 1} onClick={() => onMove(-1)}>◀</button>
              <button className="ghost" title="Move right" disabled={index >= count - 1} onClick={() => onMove(1)}>▶</button>
            </>
          )}
          <button className="ghost" title="Minimize" onClick={onToggleMinimize}>⮜</button>
          {!col.fixed && (
            <button className="ghost" title="Delete column" onClick={onRemove}>🗑</button>
          )}
        </div>
      </header>

      <div
        className="chrono-events"
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => onDropBefore(null)}
      >
        {events.length === 0 && <p className="muted" style={{ fontSize: '0.85rem' }}>No events.</p>}
        {events.map((ev) => (
          <article
            key={ev.id}
            className={`chrono-event ${dragId === ev.id ? 'dragging' : ''}`}
            draggable
            onDragStart={() => onDragStart(ev.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.stopPropagation()
              onDropBefore(ev.id)
            }}
            onClick={() => onOpenEvent(ev.id)}
          >
            <div className="chrono-event-date">{ev.date || '—'}</div>
            <strong>{ev.title || '(untitled)'}</strong>
            {ev.body && <p className="muted chrono-event-body">{ev.body}</p>}
          </article>
        ))}
        <button className="chrono-add" onClick={onAddEvent}>+ Event</button>
      </div>
    </section>
  )
}
