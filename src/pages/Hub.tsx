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
import { useConfirm } from '../components/useConfirm'
import { Logo, Button, Card, EmptyState, IconButton, Icon } from '../ds'

export function Hub() {
  const { campaigns, loaded, loading, load, create, remove } = useCampaigns()
  const isConnected = useConfig((s) => s.isConnected())
  const hydrate = useConfig((s) => s.hydrate)
  const tokenLoaded = useConfig((s) => s.tokenLoaded)
  const [showWizard, setShowWizard] = useState(false)
  const navigate = useNavigate()
  const confirm = useConfirm()

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
        <Logo size="md" />
        <div className="row">
          <Link
            to="/settings"
            className="muted row"
            style={{ textDecoration: 'none', gap: '0.35rem' }}
          >
            <Icon name="settings" size={16} /> Settings
          </Link>
          <ThemePicker />
        </div>
      </header>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Your campaigns</h2>
        <Button variant="primary" icon="plus" onClick={() => setShowWizard(true)}>New campaign</Button>
      </div>

      {!isConnected && (
        <p className="muted" style={{ marginTop: 0 }}>
          Offline mode — campaigns are saved in this browser. <Link to="/settings">Connect GitHub</Link> to sync.
        </p>
      )}

      {loading && !loaded && <p className="muted">Loading…</p>}

      {loaded && campaigns.length === 0 && (
        <EmptyState
          icon="dices"
          title="No campaigns yet"
          hint="Create your first campaign to start planning sessions, casting NPCs and tracking the story."
          action={<Button variant="primary" icon="plus" onClick={() => setShowWizard(true)}>New campaign</Button>}
          style={{ maxWidth: 480 }}
        />
      )}

      <div className="grid">
        {campaigns.map((c) => (
          <Card key={c.id} interactive pattern="paper" padding="var(--space-4)" className="campaign-card">
            <Link to={`/campaign/${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              {c.cover && <img className="cover" src={c.cover} alt="" />}
              <strong>{c.name}</strong>
              <div className="muted mb-data" style={{ marginTop: '0.4rem', fontSize: 'var(--text-xs)' }}>
                Last played: {c.lastPlayed ?? 'never'}
              </div>
            </Link>
            <span className="card-del">
              <IconButton
                icon="trash-2"
                label="Delete campaign"
                tone="danger"
                size="sm"
                onClick={() =>
                  confirm({
                    title: 'Delete campaign?',
                    message: `Delete "${c.name}"? This cannot be undone.`,
                    confirmLabel: 'Delete',
                    onConfirm: () => void remove(c.id),
                  })
                }
              />
            </span>
          </Card>
        ))}
      </div>

      {showWizard && <NewCampaignDialog onCancel={() => setShowWizard(false)} onCreate={onCreate} />}
    </div>
  )
}
