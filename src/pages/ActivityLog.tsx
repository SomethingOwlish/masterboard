// Activity log page (changelog). Shows the reverse-chronological record of edits
// made within this campaign — what changed and when. Entries are appended
// automatically by the stores; this page is read-only apart from "Clear log".

import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useActivity } from '../store/activity'

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

  useEffect(() => {
    if (campaignId && campaignId !== loadedId) void load(campaignId)
  }, [campaignId, loadedId, load])

  return (
    <div className="content" style={{ maxWidth: 760 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ marginBottom: 0 }}><span aria-hidden>📓</span> Activity log</h1>
          <p className="muted" style={{ marginTop: '0.25rem' }}>
            An automatic record of changes in this campaign — newest first.
          </p>
        </div>
        {entries.length > 0 && (
          <button onClick={() => { if (campaignId && confirm('Clear the entire activity log?')) void clear(campaignId) }}>
            Clear log
          </button>
        )}
      </div>

      {loading && entries.length === 0 && <p className="muted">Loading…</p>}

      {!loading && entries.length === 0 && (
        <div className="card" style={{ maxWidth: 480 }}>
          <strong>No activity yet</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            Edits you make — recaps, settings, the next-session plan — will be logged here.
          </p>
        </div>
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
