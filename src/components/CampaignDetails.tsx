// Editable campaign header + details + at-a-glance stats (M2). Title and cover
// edit in place; description, system, player count and planned-session count
// write through the store on change. "Sessions finished" is derived from the
// recap log, so it stays read-only and always accurate.

import { useState } from 'react'
import type { Campaign } from '../model/types'
import { useCampaign } from '../store/campaign'
import { ImageField } from './ImageField'
import { SystemSelect } from './SystemSelect'

export function CampaignDetails({ campaign, finishedCount }: { campaign: Campaign; finishedCount: number }) {
  const { rename, update } = useCampaign()
  const [editTitle, setEditTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(campaign.name)
  const [editCover, setEditCover] = useState(false)

  const saveTitle = () => {
    void rename(titleDraft)
    setEditTitle(false)
  }

  const numberOrUndefined = (raw: string): number | undefined => {
    if (raw === '') return undefined
    const n = Math.max(0, Math.floor(Number(raw)))
    return Number.isFinite(n) ? n : undefined
  }

  return (
    <section className="card">
      <div className="overview-header">
        <div className="cover-slot">
          {campaign.cover ? (
            <img className="overview-cover" src={campaign.cover} alt="" />
          ) : (
            <span className="overview-cover overview-cover-empty" aria-hidden>🎲</span>
          )}
          <button className="cover-change" onClick={() => setEditCover((v) => !v)}>
            Change
          </button>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {editTitle ? (
            <div className="row" style={{ gap: '0.4rem' }}>
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle()
                  if (e.key === 'Escape') { setTitleDraft(campaign.name); setEditTitle(false) }
                }}
                style={{ fontSize: '1.3rem', fontWeight: 700, flex: 1 }}
              />
              <button className="primary" onClick={saveTitle}>Save</button>
              <button onClick={() => { setTitleDraft(campaign.name); setEditTitle(false) }}>Cancel</button>
            </div>
          ) : (
            <div className="row" style={{ gap: '0.5rem' }}>
              <h1 style={{ margin: 0 }}>{campaign.name}</h1>
              <button className="ghost" title="Rename" onClick={() => { setTitleDraft(campaign.name); setEditTitle(true) }}>✎</button>
            </div>
          )}
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            Created {campaign.createdAt.slice(0, 10)}
            {campaign.lastPlayed && ` · last played ${campaign.lastPlayed}`}
          </p>
        </div>
      </div>

      {editCover && (
        <div className="field" style={{ marginTop: '0.5rem' }}>
          <label>Cover image</label>
          <ImageField
            value={campaign.cover}
            variant="cover"
            glyph="🎲"
            onChange={(cover) => void update({ cover })}
          />
        </div>
      )}

      <div className="stats-strip">
        <label className="stat">
          <span className="stat-label">Players</span>
          <input
            className="stat-input"
            type="number"
            min={0}
            value={campaign.playerCount ?? ''}
            onChange={(e) => void update({ playerCount: numberOrUndefined(e.target.value) })}
            placeholder="0"
          />
        </label>
        <label className="stat">
          <span className="stat-label">Sessions planned</span>
          <input
            className="stat-input"
            type="number"
            min={0}
            value={campaign.plannedSessions ?? ''}
            onChange={(e) => void update({ plannedSessions: numberOrUndefined(e.target.value) })}
            placeholder="0"
          />
        </label>
        <div className="stat">
          <span className="stat-label">Sessions finished</span>
          <span className="stat-value" title="Counts entries in the recap log">{finishedCount}</span>
        </div>
      </div>

      <div className="field" style={{ marginTop: '0.75rem' }}>
        <label htmlFor="cd-system">System</label>
        <SystemSelect value={campaign.system} onChange={(system) => void update({ system })} />
      </div>

      <div className="field">
        <label htmlFor="cd-desc">Description</label>
        <textarea
          id="cd-desc"
          rows={3}
          value={campaign.description ?? ''}
          onChange={(e) => void update({ description: e.target.value || undefined })}
          placeholder="Premise, tone, table expectations…"
        />
      </div>
    </section>
  )
}
