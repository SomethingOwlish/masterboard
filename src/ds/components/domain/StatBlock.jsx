import React from 'react'

/**
 * StatBlock — an at-a-glance metric tile for the campaign dashboard (players,
 * sessions planned, sessions finished). Mono tabular value in the display tone,
 * muted label above. Compose several in a row.
 */
export function StatBlock({ label, value, hint, accent = false, style, ...rest }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 120,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: 'var(--space-4)',
        background: accent ? 'var(--accent-soft)' : 'var(--surface-2)',
        border: `1px solid ${accent ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        ...style,
      }}
      {...rest}
    >
      <span style={{ font: 'var(--type-meta)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>{label}</span>
      <span
        className="mb-data"
        style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: accent ? 'var(--accent)' : 'var(--text)', lineHeight: 1.05 }}
      >
        {value}
      </span>
      {hint && <span style={{ font: 'var(--type-meta)', color: 'var(--muted)' }}>{hint}</span>}
    </div>
  )
}
