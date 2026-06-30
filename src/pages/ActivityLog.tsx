// Activity log page (changelog). Shows the reverse-chronological record of edits
// made within this campaign — what changed and when. Entries are appended
// automatically by the stores; this page is read-only apart from "Clear log".

import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useActivity } from '../store/activity'
import { useConfirm } from '../components/useConfirm'
import { Icon, Button, EmptyState } from '../ds'

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function ActivityLog() {
  const { campaignId } = useParams()
  const { entries, loading, campaignId: loadedId, load, clear } = useActivity()
  const confirm = useConfirm()

  useEffect(() => {
    if (campaignId && campaignId !== loadedId) void load(campaignId)
  }, [campaignId, loadedId, load])

  return (
    <div className="content" style={{ maxWidth: 760 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1 className="row" style={{ marginBottom: 0, gap: '0.5rem' }}><Icon name="scroll-text" size={24} /> Activity log</h1>
          <p className="muted" style={{ marginTop: '0.25rem' }}>
            An automatic record of changes in this campaign — newest first.
          </p>
        </div>
        {entries.length > 0 && (
          <Button
            variant="ghost"
            tone="danger"
            icon="trash-2"
            onClick={() =>
              confirm({
                title: 'Clear activity log?',
                message: 'Clear the entire activity log? This cannot be undone.',
                confirmLabel: 'Clear log',
                onConfirm: () => { if (campaignId) void clear(campaignId) },
              })
            }
          >
            Clear log
          </Button>
        )}
      </div>

      {loading && entries.length === 0 && <p className="muted">Loading…</p>}

      {!loading && entries.length === 0 && (
        <EmptyState
          icon="scroll-text"
          title="No activity yet"
          hint="Edits you make — recaps, settings, the next-session plan — will be logged here."
          style={{ maxWidth: 480, marginTop: '1rem' }}
        />
      )}

      {entries.length > 0 && (
        <ol className="activity-list">
          {entries.map((e) => (
            <li key={e.id} className="activity-item">
              <time className="activity-time muted" dateTime={e.at}>{formatTime(e.at)}</time>
              <div className="activity-body">
                <span className="activity-action">{e.action}</span>
                {e.detail && <span className="activity-detail muted"> — {e.detail}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
