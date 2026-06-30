// Sessions list (M7 / B5): the independent session documents for a campaign. Each
// card opens its Session planner board. Title follows DESIGN: `name · date · #seq`.

import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useNewAction } from '../lib/shortcuts'
import { sessionTitle, useSessions } from '../store/sessions'

export function SessionsPage() {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const sessions = useSessions((s) => s.sessions)
  const loading = useSessions((s) => s.loading)
  const load = useSessions((s) => s.load)
  const create = useSessions((s) => s.create)
  const duplicate = useSessions((s) => s.duplicate)
  const remove = useSessions((s) => s.remove)

  useEffect(() => {
    if (campaignId) void load(campaignId)
  }, [campaignId, load])

  const base = `/campaign/${campaignId}/sessions`

  async function newSession() {
    const doc = await create()
    if (doc) navigate(`${base}/${doc.id}`)
  }

  useNewAction(() => void newSession())

  async function dup(id: string) {
    const doc = await duplicate(id)
    if (doc) navigate(`${base}/${doc.id}`)
  }

  // Newest first by sequence number.
  const ordered = [...sessions].sort((a, b) => b.seq - a.seq)

  return (
    <div className="content">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>
          <span aria-hidden>🗺️</span> Sessions
        </h1>
        <button className="primary" onClick={() => void newSession()}>
          + New session
        </button>
      </div>

      {loading ? (
        <p className="muted" style={{ marginTop: '1rem' }}>Loading…</p>
      ) : ordered.length === 0 ? (
        <p className="muted" style={{ marginTop: '1rem' }}>
          No sessions yet. Plan your first one with “New session”.
        </p>
      ) : (
        <div className="grid" style={{ marginTop: '1rem' }}>
          {ordered.map((s) => (
            <div key={s.id} className="card session-card">
              <button className="session-open" onClick={() => navigate(`${base}/${s.id}`)}>
                <span className="session-seq" aria-hidden>#{s.seq}</span>
                <strong>{s.name || 'Untitled session'}</strong>
                <span className="muted">{s.realDate}</span>
              </button>
              <div className="row session-actions">
                <button className="ghost" onClick={() => void dup(s.id)}>Duplicate</button>
                <button
                  className="ghost"
                  onClick={() => {
                    if (window.confirm(`Delete session ${sessionTitle(s)}?`)) void remove(s.id)
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
