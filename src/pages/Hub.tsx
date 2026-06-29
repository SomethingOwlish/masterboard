import { Link } from 'react-router-dom'
import { useState } from 'react'
import { ThemePicker } from '../components/ThemePicker'

// Batch 0: campaigns are stubbed in memory. Batch 1 replaces this with the
// storage adapter reading <gm>/campaigns/index.json.
interface CampaignCard { id: string; name: string; lastPlayed?: string }

const DEMO: CampaignCard[] = [
  { id: 'demo', name: 'Demo Campaign', lastPlayed: 'never' },
]

export function Hub() {
  const [campaigns] = useState<CampaignCard[]>(DEMO)

  return (
    <div className="content" style={{ maxWidth: 980, margin: '0 auto' }}>
      <header className="row" style={{ justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>🎲 Masterboard</h1>
        <ThemePicker />
      </header>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Your campaigns</h2>
        <button className="primary" disabled title="Enabled in Batch 1">+ New campaign</button>
      </div>

      <div className="grid">
        {campaigns.map((c) => (
          <Link key={c.id} to={`/campaign/${c.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <strong>{c.name}</strong>
            <div className="muted" style={{ marginTop: '0.4rem' }}>Last played: {c.lastPlayed}</div>
          </Link>
        ))}
      </div>

      <p className="muted" style={{ marginTop: '2rem' }}>
        Batch 0 — shell only. Storage, campaign creation, and modules arrive in later batches.
      </p>
    </div>
  )
}
