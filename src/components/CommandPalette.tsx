// Command palette (B10). Cmd/Ctrl-K (or the topbar Search button) opens a
// fuzzy-ish jump list scoped to the open campaign: every module, every session,
// and every entity (PCs / NPCs / locations / misc). Enter navigates; entities
// deep-link with ?focus=<id> so the destination page opens that record's drawer.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MODULES } from '../modules'
import { KIND_GLYPH, KIND_MODULE, useEntityPool } from '../store/entities'
import { sessionTitle, useSessions } from '../store/sessions'

interface Item {
  key: string
  icon: string
  label: string
  sub: string
  to: string
}

export function CommandPalette({
  open,
  onClose,
  campaignId,
}: {
  open: boolean
  onClose: () => void
  campaignId: string
}) {
  const navigate = useNavigate()
  const base = `/campaign/${campaignId}`

  const pool = useEntityPool(campaignId)
  const sessions = useSessions((s) => s.sessions)
  const loadSessions = useSessions((s) => s.load)

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (open) {
      void loadSessions(campaignId)
      setQuery('')
      setActive(0)
    }
  }, [open, campaignId, loadSessions])

  const items = useMemo<Item[]>(() => {
    const modules: Item[] = MODULES.map((m) => ({
      key: `mod:${m.id}`,
      icon: m.icon,
      label: m.label,
      sub: m.blurb,
      to: m.path === '' ? base : `${base}/${m.path}`,
    }))
    const sess: Item[] = [...sessions]
      .sort((a, b) => b.seq - a.seq)
      .map((s) => ({
        key: `sess:${s.id}`,
        icon: '🗺️',
        label: sessionTitle(s),
        sub: 'Session',
        to: `${base}/sessions/${s.id}`,
      }))
    const entities: Item[] = pool.map((e) => ({
      key: `ent:${e.id}`,
      icon: KIND_GLYPH[e.kind],
      label: e.name,
      sub: KIND_MODULE[e.kind],
      to: `${base}/${KIND_MODULE[e.kind]}?focus=${e.id}`,
    }))
    return [...modules, ...sess, ...entities]
  }, [base, pool, sessions])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? items.filter((it) => `${it.label} ${it.sub}`.toLowerCase().includes(q)) : items
    return list.slice(0, 50)
  }, [items, query])

  useEffect(() => {
    if (active >= filtered.length) setActive(0)
  }, [filtered, active])

  if (!open) return null

  function go(it: Item | undefined) {
    if (!it) return
    onClose()
    navigate(it.to)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(filtered[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="palette-scrim" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <input
          className="palette-input"
          autoFocus
          value={query}
          placeholder="Jump to a module, session, or entity…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="palette-results">
          {filtered.length === 0 ? (
            <p className="muted" style={{ padding: '0.5rem 0.75rem', margin: 0 }}>No matches.</p>
          ) : (
            filtered.map((it, i) => (
              <button
                key={it.key}
                className={`palette-result ${i === active ? 'active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(it)}
              >
                <span aria-hidden className="palette-result-icon">{it.icon}</span>
                <span className="palette-result-label">{it.label}</span>
                <span className="palette-result-sub muted">{it.sub}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
