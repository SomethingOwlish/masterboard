import { TextField } from '../../ds'
import { CLOCK_REASONS } from '../../local/labels'

/**
 * Reason for a clock move with quick chips (ТЗ-3, этап 12): the same field in
 * the live panel and in the review. `extra` chips go first (e.g. «Итоги сессии №3»).
 */
export function ClockReasonField({ title, value, onChange, extra = [] }: {
  title: string
  value: string
  onChange: (reason: string) => void
  extra?: string[]
}) {
  return <div className="clock-reason">
    <TextField
      aria-label={`Причина: ${title}`}
      value={value}
      placeholder="Причина…"
      onChange={(event) => onChange(event.target.value)}
    />
    <div
      className="clock-reason__chips"
      role="group"
      aria-label={`Быстрые причины: ${title}`}
    >
      {[...extra, ...CLOCK_REASONS].map((reason) => <button
        key={reason}
        type="button"
        className={`home-chip${value === reason ? ' on' : ''}`}
        aria-pressed={value === reason}
        onClick={() => onChange(reason)}
      >
        {reason}
      </button>)}
    </div>
  </div>
}
