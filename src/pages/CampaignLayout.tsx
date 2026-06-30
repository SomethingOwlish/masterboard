import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useParams, useNavigate, Link } from 'react-router-dom'
import { MODULES } from '../modules'
import { ThemePicker } from '../components/ThemePicker'
import { SyncIndicator } from '../components/SyncIndicator'
import { CommandPalette } from '../components/CommandPalette'
import { useCampaign } from '../store/campaign'
import { useConfig } from '../store/config'
import { emitNewAction, isTypingTarget } from '../lib/shortcuts'

// `g` then one of these jumps to a module (vim/Gmail style). Keys chosen to be
// memorable per module; surfaced in the burger menu's footer hint.
const NAV_KEYS: Record<string, string> = {
  o: 'overview', c: 'characters', n: 'npcs', r: 'relations', h: 'chronology',
  s: 'sessions', l: 'locations', m: 'misc', t: 'tasks', u: 'rules',
  a: 'activity', p: 'print', e: 'settings',
}

export function CampaignLayout() {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
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

  // Global shortcuts (B10). Cmd/Ctrl-K toggles the palette anywhere; the single-key
  // shortcuts (`g`-prefixed nav, `n` for new) defer while typing or when an overlay
  // owns the keyboard. `routeFor` resolves a module id to its campaign route.
  const gPending = useRef(false)
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const routeFor = (moduleId: string) => {
      const m = MODULES.find((x) => x.id === moduleId)
      if (!m) return null
      return m.path === '' ? base : `${base}/${m.path}`
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      if (paletteOpen || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return

      if (gPending.current) {
        gPending.current = false
        if (gTimer.current) clearTimeout(gTimer.current)
        const target = NAV_KEYS[e.key.toLowerCase()]
        if (target) {
          const route = routeFor(target)
          if (route) {
            e.preventDefault()
            navigate(route)
          }
        }
        return
      }
      if (e.key === 'g') {
        gPending.current = true
        if (gTimer.current) clearTimeout(gTimer.current)
        gTimer.current = setTimeout(() => (gPending.current = false), 1500)
      } else if (e.key === 'n') {
        e.preventDefault()
        emitNewAction()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [base, navigate, paletteOpen])

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
        <p className="rail-hint muted">
          <kbd>⌘K</kbd> search · <kbd>g</kbd> then a key to jump · <kbd>n</kbd> new
        </p>
      </aside>

      <div className={`scrim ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />

      <div className="main">
        <div className="topbar">
          <button className="burger" onClick={() => setOpen((v) => !v)} aria-label="Menu">☰</button>
          <strong style={{ flex: 1 }}>{campaign?.name ?? `Campaign: ${campaignId}`}</strong>
          <div className="no-print row">
            <button className="ghost palette-trigger" onClick={() => setPaletteOpen(true)} aria-label="Search">
              🔍 <span className="palette-trigger-text">Search</span>
            </button>
            <SyncIndicator />
            <ThemePicker />
          </div>
        </div>
        <Outlet />
      </div>

      {campaignId && (
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} campaignId={campaignId} />
      )}
    </div>
  )
}
