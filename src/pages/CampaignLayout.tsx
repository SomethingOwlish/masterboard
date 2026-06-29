import { useEffect, useState } from 'react'
import { NavLink, Outlet, useParams, Link } from 'react-router-dom'
import { MODULES } from '../modules'
import { ThemePicker } from '../components/ThemePicker'
import { SyncIndicator } from '../components/SyncIndicator'
import { useCampaign } from '../store/campaign'
import { useConfig } from '../store/config'

export function CampaignLayout() {
  const { campaignId } = useParams()
  const [open, setOpen] = useState(false)
  const base = `/campaign/${campaignId}`

  const openCampaign = useCampaign((s) => s.open)
  const campaign = useCampaign((s) => s.campaign)
  const tokenLoaded = useConfig((s) => s.tokenLoaded)
  const hydrate = useConfig((s) => s.hydrate)

  // Make sure the token is hydrated before the first (possibly remote) read.
  useEffect(() => {
    if (!tokenLoaded) void hydrate()
  }, [tokenLoaded, hydrate])

  useEffect(() => {
    if (tokenLoaded && campaignId) void openCampaign(campaignId)
  }, [tokenLoaded, campaignId, openCampaign])

  return (
    <div className="shell">
      <aside className={`rail ${open ? 'open' : ''}`}>
        <div className="brand">
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>🎲 Masterboard</Link>
        </div>
        <nav onClick={() => setOpen(false)}>
          {MODULES.map((m) => (
            <NavLink
              key={m.id}
              end={m.path === ''}
              to={m.path === '' ? base : `${base}/${m.path}`}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <span aria-hidden>{m.icon}</span> {m.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className={`scrim ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />

      <div className="main">
        <div className="topbar">
          <button className="burger" onClick={() => setOpen((v) => !v)} aria-label="Menu">☰</button>
          <strong style={{ flex: 1 }}>{campaign?.name ?? `Campaign: ${campaignId}`}</strong>
          <div className="no-print row">
            <SyncIndicator />
            <ThemePicker />
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
