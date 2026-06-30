import { useEffect, useRef, useState } from 'react'
import { Outlet, useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { MODULES } from '../modules'
import { ThemePicker } from '../components/ThemePicker'
import { SyncIndicator } from '../components/SyncIndicator'
import { CommandPalette } from '../components/CommandPalette'
import { useCampaign } from '../store/campaign'
import { useConfig } from '../store/config'
import { emitNewAction, isTypingTarget } from '../lib/shortcuts'
import { SidebarNav, Topbar, Logo, IconButton } from '../ds'

// `g` then one of these jumps to a module (vim/Gmail style). Keys chosen to be
// memorable per module; surfaced in the rail's footer hint.
const NAV_KEYS: Record<string, string> = {
  o: 'overview', c: 'characters', n: 'npcs', r: 'relations', h: 'chronology',
  s: 'sessions', l: 'locations', m: 'misc', t: 'tasks', u: 'rules',
  a: 'activity', p: 'print', e: 'settings',
}

export function CampaignLayout() {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
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

  const routeFor = (m: { path: string }) => (m.path === '' ? base : `${base}/${m.path}`)
  // Active module = the deepest route prefix match (overview is the bare base).
  const activeId =
    MODULES.filter((m) => m.path !== '' && location.pathname.startsWith(`${base}/${m.path}`))
      .sort((a, b) => b.path.length - a.path.length)[0]?.id ?? 'overview'

  // Global shortcuts (B10). Cmd/Ctrl-K toggles the palette anywhere; the single-key
  // shortcuts (`g`-prefixed nav, `n` for new) defer while typing or when an overlay
  // owns the keyboard.
  const gPending = useRef(false)
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const routeForId = (moduleId: string) => {
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
          const route = routeForId(target)
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
      <SidebarNav
        className={`rail ${open ? 'open' : ''}`}
        items={MODULES.map((m) => ({ id: m.id, label: m.label, icon: m.icon }))}
        activeId={activeId}
        onSelect={(id) => {
          const m = MODULES.find((x) => x.id === id)
          if (m) navigate(routeFor(m))
          setOpen(false)
        }}
        header={
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }} aria-label="All campaigns">
            <Logo size="sm" />
          </Link>
        }
        footer={
          <p className="rail-hint muted" style={{ margin: 0 }}>
            <kbd>⌘K</kbd> search · <kbd>g</kbd> then a key to jump · <kbd>n</kbd> new
          </p>
        }
      />

      <div className={`scrim ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />

      <div className="main">
        <Topbar
          title={campaign?.name ?? `Campaign: ${campaignId}`}
          left={
            <span className="burger">
              <IconButton icon="panel-left" label="Menu" onClick={() => setOpen((v) => !v)} />
            </span>
          }
          right={
            <div className="no-print row" style={{ gap: '0.5rem' }}>
              <IconButton icon="search" label="Search" onClick={() => setPaletteOpen(true)} />
              <SyncIndicator />
              <ThemePicker />
            </div>
          }
        />
        <Outlet />
      </div>

      {campaignId && (
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} campaignId={campaignId} />
      )}
    </div>
  )
}
