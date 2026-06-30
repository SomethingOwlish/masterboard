// New-campaign wizard (M1). Minimal at this batch: name, optional cover URL, and
// a starting theme family. Source sites / task site / storage overrides are edited
// later from the campaign's own Settings as those modules come online.

import { useState } from 'react'
import { FAMILIES } from '../theme'
import type { ThemeId } from '../model/types'
import { Modal, TextField, Select, Button } from '../ds'

interface Props {
  onCancel: () => void
  onCreate: (input: { name: string; cover?: string; theme: ThemeId }) => void
}

export function NewCampaignDialog({ onCancel, onCreate }: Props) {
  const [name, setName] = useState('')
  const [cover, setCover] = useState('')
  const [theme, setTheme] = useState<ThemeId>('parchment')

  const submit = () => {
    if (!name.trim()) return
    onCreate({ name, cover: cover.trim() || undefined, theme })
  }

  return (
    <Modal
      open
      onClose={onCancel}
      icon="dices"
      title="New campaign"
      subtitle="Name it, pick a look — you can change everything later."
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" icon="plus" onClick={submit} disabled={!name.trim()}>Create</Button>
        </>
      }
    >
      <div className="mb-stack">
        <TextField
          label="Name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="The Sunless Citadel"
        />
        <TextField
          label="Cover image URL (optional)"
          value={cover}
          onChange={(e) => setCover(e.target.value)}
          placeholder="https://…"
        />
        <Select label="Theme" value={theme} onChange={(e) => setTheme(e.target.value as ThemeId)}>
          {FAMILIES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </Select>
      </div>
    </Modal>
  )
}
