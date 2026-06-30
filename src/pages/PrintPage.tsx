// Print / Export compiler (M12 / B9). Pick a session and compile a single
// print-optimized sheet: the party roster (character block) plus every scene with
// its placed NPCs / locations / items / events expanded to their full data. The
// `@media print` rules (index.css) hide the app chrome so the browser's "Save as
// PDF" yields one clean sheet with everything the GM needs at the table.

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { Field, SessionDoc } from '../model/types'
import { compilePrint, type ResolvedMember } from '../lib/print'
import { useCampaign } from '../store/campaign'
import { useChronology } from '../store/chronology'
import { useEntityPool } from '../store/entities'
import { useLocations } from '../store/locations'
import { useMisc } from '../store/misc'
import { useNpcs } from '../store/npcs'
import { sessionTitle, useSessions } from '../store/sessions'
import { data } from '../storage/data'
import { Icon, Button, Select } from '../ds'

export function PrintPage() {
  const { campaignId } = useParams()
  const [params] = useSearchParams()

  const campaign = useCampaign((s) => s.campaign)
  const characters = useCampaign((s) => s.characters)
  const sessions = useSessions((s) => s.sessions)
  const loadSessions = useSessions((s) => s.load)

  // useEntityPool triggers the npc/location/misc/relations loads; we read the full
  // records straight from those stores for the compiled detail.
  useEntityPool(campaignId)
  const npcs = useNpcs((s) => s.npcs)
  const locations = useLocations((s) => s.locations)
  const misc = useMisc((s) => s.misc)
  const events = useChronology((s) => s.events)
  const loadChrono = useChronology((s) => s.load)

  const [sessionId, setSessionId] = useState('')
  const [doc, setDoc] = useState<SessionDoc | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(false)

  useEffect(() => {
    if (campaignId) {
      void loadSessions(campaignId)
      void loadChrono(campaignId)
    }
  }, [campaignId, loadSessions, loadChrono])

  // Default the picker to the deep-linked session, else the newest one.
  const ordered = useMemo(() => [...sessions].sort((a, b) => b.seq - a.seq), [sessions])
  useEffect(() => {
    if (sessionId || ordered.length === 0) return
    const wanted = params.get('session')
    const initial = wanted && ordered.some((s) => s.id === wanted) ? wanted : ordered[0].id
    setSessionId(initial)
  }, [ordered, sessionId, params])

  // Load the full session document whenever the selection changes.
  useEffect(() => {
    if (!campaignId || !sessionId) {
      setDoc(null)
      return
    }
    let cancelled = false
    setLoadingDoc(true)
    void data.readSession(campaignId, sessionId).then((d) => {
      if (!cancelled) {
        setDoc(d)
        setLoadingDoc(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [campaignId, sessionId])

  const compiled = useMemo(
    () => (doc ? compilePrint(doc, { characters, npcs, locations, misc, events }) : null),
    [doc, characters, npcs, locations, misc, events],
  )

  const selectedMeta = ordered.find((s) => s.id === sessionId)

  return (
    <div className="content print-page">
      <div className="row no-print" style={{ justifyContent: 'space-between' }}>
        <h1 className="row" style={{ margin: 0, gap: '0.5rem' }}>
          <Icon name="printer" size={24} /> Print
        </h1>
        <div className="row" style={{ gap: '0.5rem' }}>
          <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)} containerStyle={{ minWidth: 180 }}>
            {ordered.length === 0 && <option value="">No sessions</option>}
            {ordered.map((s) => (
              <option key={s.id} value={s.id}>
                {sessionTitle(s)}
              </option>
            ))}
          </Select>
          <Button variant="primary" icon="printer" onClick={() => window.print()} disabled={!compiled}>
            Print / Save as PDF
          </Button>
        </div>
      </div>

      {ordered.length === 0 ? (
        <p className="muted" style={{ marginTop: '1rem' }}>
          No sessions to compile yet. Create one in the Sessions module first.
        </p>
      ) : loadingDoc || !compiled || !selectedMeta ? (
        <p className="muted" style={{ marginTop: '1rem' }}>Compiling…</p>
      ) : (
        <article className="print-sheet">
          <header className="print-head">
            <h2 style={{ margin: 0 }}>{campaign?.name ?? 'Campaign'}</h2>
            <p className="muted" style={{ margin: '0.2rem 0 0' }}>{sessionTitle(selectedMeta)}</p>
          </header>

          <section className="print-section">
            <h3 className="print-section-title row" style={{ gap: '0.4rem' }}><Icon name="shield" size={18} /> Party</h3>
            {compiled.party.length === 0 ? (
              <p className="muted">No characters in this campaign.</p>
            ) : (
              <ul className="print-party">
                {compiled.party.map((c) => (
                  <li key={c.id}>
                    <strong>{c.name || '(unnamed)'}</strong>
                    {c.playerName && <span className="muted"> · {c.playerName}</span>}
                    <FieldList fields={c.fields} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="print-section">
            <h3 className="print-section-title row" style={{ gap: '0.4rem' }}><Icon name="map" size={18} /> Scenes</h3>
            {compiled.scenes.length === 0 ? (
              <p className="muted">
                No scenes on this session's board. Draw a scene frame in the Session planner and drop
                tokens into it.
              </p>
            ) : (
              compiled.scenes.map((scene) => (
                <div key={scene.id} className="print-scene">
                  <h4 className="print-scene-title">{scene.name}</h4>
                  {scene.members.length === 0 ? (
                    <p className="muted print-empty">No members placed in this scene.</p>
                  ) : (
                    <div className="print-members">
                      {scene.members.map((m, idx) => (
                        <MemberCard key={`${m.id}-${idx}`} member={m} />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </section>

          {compiled.missing > 0 && (
            <p className="muted print-note">
              {compiled.missing} placed item(s) reference entities that have since been deleted.
            </p>
          )}
        </article>
      )}
    </div>
  )
}

function FieldList({ fields }: { fields: Field[] }) {
  const filled = fields.filter((f) => f.label.trim() || f.value.trim())
  if (filled.length === 0) return null
  return (
    <dl className="print-fields">
      {filled.map((f) => (
        <div key={f.id} className="print-field">
          <dt>{f.label || '—'}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}

const MEMBER_ICON: Record<string, string> = {
  pc: 'shield',
  npc: 'drama',
  location: 'map-pin',
  misc: 'dices',
  event: 'history',
  unknown: 'circle-help',
}

function MemberCard({ member }: { member: ResolvedMember }) {
  return (
    <div className="print-member">
      <div className="print-member-head row" style={{ gap: '0.35rem' }}>
        <Icon name={MEMBER_ICON[member.kind] ?? 'circle-help'} size={16} />{' '}
        <strong>{member.name}</strong>
        {member.npc?.dead && <span className="muted row" style={{ gap: '0.2rem' }}> · <Icon name="skull" size={13} /> dead</span>}
        {member.misc && <span className="muted"> · {member.misc.kind}</span>}
        {member.event?.date && <span className="muted"> · {member.event.date}</span>}
      </div>

      {member.npc && (
        <>
          {member.npc.notes && <p className="print-member-body">{member.npc.notes}</p>}
          <FieldList fields={member.npc.fields} />
          <TagRow tags={member.npc.tags} />
        </>
      )}
      {member.location && (
        <>
          {member.location.description && <p className="print-member-body">{member.location.description}</p>}
          <TagRow tags={member.location.tags} />
        </>
      )}
      {member.misc && (
        <>
          {member.misc.body && <p className="print-member-body">{member.misc.body}</p>}
          <FieldList fields={member.misc.fields} />
          <TagRow tags={member.misc.tags} />
        </>
      )}
      {member.event?.body && <p className="print-member-body">{member.event.body}</p>}
      {member.character?.playerName && <p className="print-member-body muted">Player: {member.character.playerName}</p>}
    </div>
  )
}

function TagRow({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return <p className="print-tags muted">{tags.map((t) => `#${t}`).join(' ')}</p>
}
