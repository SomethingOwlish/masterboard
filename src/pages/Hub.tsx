// Hub (M1): the GM's campaign grid backed by the storage layer. Create opens the
// wizard; cards link into the campaign shell. Works offline; syncs to GitHub when
// Settings are configured.

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ThemePicker } from '../components/ThemePicker'
import { NewCampaignDialog } from '../components/NewCampaignDialog'
import type { ThemeId } from '../model/types'
import { useCampaigns } from '../store/campaigns'
import { useConfig } from '../store/config'

export function Hub() {
  const { campaigns, loaded, loading, load, create, remove } = useCampaigns()
  const isConnected = useConfig((s) => s.isConnected())
  const hydrate = useConfig((s) => s.hydrate)
  const tokenLoaded = useConfig((s) => s.tokenLoaded)
  const [showWizard, setShowWizard] = useState(false)
  const navigate = useNavigate()

  // Load the token first so the very first index read can hit GitHub if configured.
  useEffect(() => {
    if (!tokenLoaded) void hydrate()
  }, [tokenLoaded, hydrate])

  useEffect(() => {
    if (tokenLoaded) void load()
  }, [tokenLoaded, load])

  const onCreate = async (input: { name: string; cover?: string; theme: ThemeId }) => {
    const campaign = await create(input)
    setShowWizard(false)
    navigate(`/campaign/${campaign.id}`)
  }

  return (
    <div className="content" style={{ maxWidth: 980, margin: '0 auto' }}>
      <header className="row" style={{ justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>🎲 Masterboard</h1>
        <div className="row">
          <Link to="/settings" className="muted" style={{ textDecoration: 'none' }}>⚙️ Settings</Link>
          <ThemePicker />
        </div>
      </header>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Your campaigns</h2>
        <button className="primary" onClick={() => setShowWizard(true)}>+ New campaign</button>
      </div>

      {!isConnected && (
        <p className="muted" style={{ marginTop: 0 }}>
          Offline mode — campaigns are saved in this browser. <Link to="/settings">Connect GitHub</Link> to sync.
        </p>
      )}

      {loading && !loaded && <p className="muted">Loading…</p>}

      {loaded && campaigns.length === 0 && (
        <div className="card" style={{ maxWidth: 480 }}>
          <strong>No campaigns yet</strong>
          <p className="muted" style={{ marginBottom: 0 }}>Create your first campaign to get started.</p>
        </div>
      )}

      <div className="grid">
        {campaigns.map((c) => (
          <div key={c.id} className="card campaign-card">
            <Link to={`/campaign/${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              {c.cover && <img className="cover" src={c.cover} alt="" />}
              <strong>{c.name}</strong>
              <div className="muted" style={{ marginTop: '0.4rem' }}>
                Last played: {c.lastPlayed ?? 'never'}
              </div>
            </Link>
            <button
              className="card-del"
              title="Delete campaign"
              onClick={() => {
                if (confirm(`Delete "${c.name}"? This cannot be undone.`)) void remove(c.id)
              }}
            >
              🗑
            </button>
          </div>
        ))}
      </div>

      {showWizard && <NewCampaignDialog onCancel={() => setShowWizard(false)} onCreate={onCreate} />}
    </div>
  )
}
