// Character block (M2): compact, read-only roster of player characters, reused
// later by the Print compiler. Editing lives in the Characters module (B3); here
// we just surface who's at the table.

import { Link } from 'react-router-dom'
import type { Character } from '../model/types'

export function CharacterBlock({ campaignId, characters }: { campaignId: string; characters: Character[] }) {
  return (
    <section className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section-title" style={{ margin: 0 }}>🛡️ Party</h2>
        <Link className="muted" to={`/campaign/${campaignId}/characters`}>Manage →</Link>
      </div>

      {characters.length === 0 ? (
        <p className="muted" style={{ marginBottom: 0 }}>
          No characters yet. They'll appear here once added in the Characters module.
        </p>
      ) : (
        <ul className="roster">
          {characters.map((c) => (
            <li key={c.id} className="roster-item">
              {c.portrait ? (
                <img className="avatar" src={c.portrait} alt="" />
              ) : (
                <span className="avatar avatar-empty" aria-hidden>🛡️</span>
              )}
              <div>
                <strong>{c.name}</strong>
                {c.playerName && <div className="muted">{c.playerName}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
