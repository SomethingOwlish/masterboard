// New-campaign wizard (M1). Minimal at this batch: name, optional cover URL, and
// a starting theme. Source sites / task site / storage overrides are edited later
// from the campaign's own Settings as those modules come online.

import { useState } from 'react'
import { THEMES } from '../theme'
import type { ThemeId } from '../model/types'

interface Props {
  onCancel: () => void
  onCreate: (input: { name: string; cover?: string; theme: ThemeId }) => void
}

export function NewCampaignDialog({ onCancel, onCreate }: Props) {
  const [name, setName] = useState('')
  const [cover, setCover] = useState('')
  const [theme, setTheme] = useState<ThemeId>('parchment')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onCreate({ name, cover: cover.trim() || undefined, theme })
  }

  return (
    <div className="modal-scrim" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 style={{ marginTop: 0 }}>New campaign</h2>

        <div className="field">
          <label htmlFor="nc-name">Name</label>
          <input id="nc-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="The Sunless Citadel" />
        </div>

        <div className="field">
          <label htmlFor="nc-cover">Cover image URL <span className="muted">(optional)</span></label>
          <input id="nc-cover" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://…" />
        </div>

        <div className="field">
          <label htmlFor="nc-theme">Theme</label>
          <select id="nc-theme" value={theme} onChange={(e) => setTheme(e.target.value as ThemeId)}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" className="primary" disabled={!name.trim()}>Create</button>
        </div>
      </form>
    </div>
  )
}
