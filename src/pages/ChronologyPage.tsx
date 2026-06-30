// In-world chronology (M6 / B4): horizontally-scrolling columns of dated events.
// The "Campaign" column is fixed (pinned left, undeletable). Events sort by their
// free-text date by default; drag a card within its column to override the order.

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Drawer } from '../components/Drawer'
import type { ChronoColumn, ChronoEvent } from '../model/types'
import { useChronology } from '../store/chronology'
import { useConfirm } from '../components/useConfirm'
import { Icon, Button, IconButton, TextField, Select, ChronoEvent as ChronoEventCard } from '../ds'

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
  const confirm = useConfirm()

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
        <h1 className="row" style={{ margin: 0, gap: '0.5rem' }}>
          <Icon name="history" size={24} /> Chronology
        </h1>
        <Button icon="plus" onClick={() => void addColumn('New column')}>Column</Button>
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
            onRemove={() =>
              confirm({
                title: 'Delete column?',
                message: `Delete "${col.name}" and its events? This cannot be undone.`,
                confirmLabel: 'Delete',
                onConfirm: () => void removeColumn(col.id),
              })
            }
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
              <Button
                variant="ghost"
                tone="danger"
                icon="trash-2"
                onClick={() =>
                  confirm({
                    title: 'Delete event?',
                    message: `Delete "${editing.title || 'this event'}"? This cannot be undone.`,
                    confirmLabel: 'Delete',
                    onConfirm: () => {
                      void removeEvent(editing.id)
                      setOpenEventId(null)
                    },
                  })
                }
              >
                Delete
              </Button>
              <Button variant="primary" onClick={() => setOpenEventId(null)}>
                Done
              </Button>
            </>
          }
        >
          <TextField
            label="Title"
            value={editing.title}
            onChange={(e) => void updateEvent(editing.id, { title: e.target.value })}
          />
          <TextField
            label="Date"
            value={editing.date}
            placeholder="e.g. 3rd of Harvest, 1024"
            hint="Free-form. Default order is by this text; drag cards to override."
            onChange={(e) => void updateEvent(editing.id, { date: e.target.value })}
          />
          <Select
            label="Column"
            value={editing.columnId}
            onChange={(e) => void updateEvent(editing.id, { columnId: e.target.value })}
          >
            {sortedColumns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <TextField
            label="Notes"
            multiline
            rows={5}
            value={editing.body ?? ''}
            onChange={(e) => void updateEvent(editing.id, { body: e.target.value || undefined })}
          />
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
          <span className="chrono-col-min-name">{col.name}</span>
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
              <IconButton icon="chevron-left" label="Move left" size="sm" disabled={index <= 1} onClick={() => onMove(-1)} />
              <IconButton icon="chevron-right" label="Move right" size="sm" disabled={index >= count - 1} onClick={() => onMove(1)} />
            </>
          )}
          <IconButton icon="panel-left-close" label="Minimize" size="sm" onClick={onToggleMinimize} />
          {!col.fixed && (
            <IconButton icon="trash-2" label="Delete column" size="sm" tone="danger" onClick={onRemove} />
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
          <ChronoEventCard
            key={ev.id}
            date={ev.date}
            title={ev.title}
            body={ev.body}
            dragging={dragId === ev.id}
            onClick={() => onOpenEvent(ev.id)}
            draggable
            onDragStart={() => onDragStart(ev.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.stopPropagation()
              onDropBefore(ev.id)
            }}
          />
        ))}
        <button className="chrono-add" onClick={onAddEvent}>+ Event</button>
      </div>
    </section>
  )
}
