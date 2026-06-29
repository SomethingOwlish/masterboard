// Reusable tag editor: chips with remove + an add input. Used by Characters,
// NPCs (and later Locations / Misc). Tags are deduped, case-insensitively.

import { useState } from 'react'
import type { Tag } from '../model/types'

export function TagEditor({ tags, onChange }: { tags: Tag[]; onChange: (tags: Tag[]) => void }) {
  const [draft, setDraft] = useState('')

  function add() {
    const t = draft.trim()
    if (!t) return
    if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...tags, t])
    setDraft('')
  }

  return (
    <div>
      <div className="chips">
        {tags.map((t) => (
          <span key={t} className="chip">
            {t}
            <button className="chip-x" aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="row" style={{ marginTop: '0.4rem' }}>
        <input
          value={draft}
          placeholder="Add tag…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          style={{ flex: 1 }}
        />
        <button onClick={add}>Add</button>
      </div>
    </div>
  )
}
