// System dropdown with an inline "add your own" option. Selecting "+ Add system…"
// reveals a text field; the new system is registered globally (systems.ts) and
// selected for this campaign.

import { useState } from 'react'
import { addSystem, getSystems } from '../systems'

interface Props {
  value: string | undefined
  onChange: (system: string | undefined) => void
}

const ADD = '__add__'

export function SystemSelect({ value, onChange }: Props) {
  const [systems, setSystems] = useState<string[]>(getSystems)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const commitNew = () => {
    const name = draft.trim()
    if (!name) {
      setAdding(false)
      return
    }
    setSystems(addSystem(name))
    onChange(name)
    setDraft('')
    setAdding(false)
  }

  if (adding) {
    return (
      <div className="row" style={{ gap: '0.4rem' }}>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitNew()
            }
            if (e.key === 'Escape') setAdding(false)
          }}
          placeholder="New system name"
        />
        <button onClick={commitNew}>Add</button>
        <button onClick={() => setAdding(false)}>Cancel</button>
      </div>
    )
  }

  return (
    <select
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value
        if (v === ADD) {
          setAdding(true)
        } else {
          onChange(v || undefined)
        }
      }}
    >
      <option value="">— none —</option>
      {systems.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
      <option value={ADD}>+ Add system…</option>
    </select>
  )
}
