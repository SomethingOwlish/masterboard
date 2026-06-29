// Next-session planner (M2): pin the real-world date, keep an attendee checklist,
// and jot the agenda for "what we'll do next time". Writes through the store on
// every change (debounced to GitHub by the repository).

import { useState } from 'react'
import type { NextSessionPlan } from '../model/types'
import { useCampaign } from '../store/campaign'

export function NextSessionPlanner({ plan }: { plan: NextSessionPlan }) {
  const setNextSession = useCampaign((s) => s.setNextSession)
  const [attendee, setAttendee] = useState('')

  const addAttendee = () => {
    const name = attendee.trim()
    if (!name || plan.attendees.includes(name)) {
      setAttendee('')
      return
    }
    void setNextSession({ attendees: [...plan.attendees, name] })
    setAttendee('')
  }

  const removeAttendee = (name: string) =>
    void setNextSession({ attendees: plan.attendees.filter((a) => a !== name) })

  return (
    <section className="card">
      <h2 className="section-title">🗓️ Next session</h2>

      <div className="field">
        <label htmlFor="ns-date">Date</label>
        <input
          id="ns-date"
          type="date"
          value={plan.date ?? ''}
          onChange={(e) => void setNextSession({ date: e.target.value || undefined })}
        />
      </div>

      <div className="field">
        <label>Attendees</label>
        <div className="row" style={{ gap: '0.4rem' }}>
          <input
            value={attendee}
            onChange={(e) => setAttendee(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addAttendee()
              }
            }}
            placeholder="Add a player…"
          />
          <button onClick={addAttendee}>Add</button>
        </div>
        {plan.attendees.length > 0 && (
          <div className="chips">
            {plan.attendees.map((a) => (
              <span key={a} className="chip">
                {a}
                <button className="chip-x" aria-label={`Remove ${a}`} onClick={() => removeAttendee(a)}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="ns-agenda">Agenda</label>
        <textarea
          id="ns-agenda"
          rows={4}
          value={plan.agenda}
          onChange={(e) => void setNextSession({ agenda: e.target.value })}
          placeholder="Scenes to run, hooks to drop, loose threads…"
        />
      </div>

      <div className="field">
        <label htmlFor="ns-notes">Notes</label>
        <textarea
          id="ns-notes"
          rows={2}
          value={plan.notes ?? ''}
          onChange={(e) => void setNextSession({ notes: e.target.value || undefined })}
          placeholder="Anything else to remember"
        />
      </div>
    </section>
  )
}
