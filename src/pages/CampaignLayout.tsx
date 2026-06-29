import { useState } from 'react'
import { NavLink, Outlet, useParams, Link } from 'react-router-dom'
import { MODULES } from '../modules'
import { ThemePicker } from '../components/ThemePicker'

export function CampaignLayout() {
  const { campaignId } = useParams()
  const [open, setOpen] = useState(false)
  const base = `/campaign/${campaignId}`

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
          <strong style={{ flex: 1 }}>Campaign: {campaignId}</strong>
          <div className="no-print"><ThemePicker /></div>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
