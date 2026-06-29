// Connected-site panel (M2): lists the campaign's source sites with an "open"
// button. Live data pulls (the ImportAdapter) arrive in Batch 8 — until then the
// panel is honest about what it can do and links out to the sites.

import type { SourceSite } from '../model/types'

export function SourcePanel({ sites }: { sites: SourceSite[] }) {
  return (
    <section className="card">
      <h2 className="section-title">🔗 Connected sites</h2>
      {sites.length === 0 ? (
        <p className="muted" style={{ marginBottom: 0 }}>
          No source sites configured. Add them in campaign settings (arriving with imports in Batch 8)
          to pull data in and link out.
        </p>
      ) : (
        <ul className="source-list">
          {sites.map((s) => (
            <li key={s.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{s.label}</span>
              <a href={s.url} target="_blank" rel="noreferrer noopener">Open ↗</a>
            </li>
          ))}
        </ul>
      )}
      <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
        Pulling data from sources lands in Batch 8.
      </p>
    </section>
  )
}
