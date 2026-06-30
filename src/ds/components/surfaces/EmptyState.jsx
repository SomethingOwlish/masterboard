import React from 'react'
import { Icon } from '../core/Icon'

/**
 * EmptyState — the calm "nothing here yet" panel used across modules (no
 * characters, no NPCs match filters, empty timeline). A woven-pattern tile, a
 * Lucide glyph, a line of guidance and an optional action.
 */
export function EmptyState({ icon = 'dices', title, hint, action, style, ...rest }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-7) var(--space-5)',
        border: '1px dashed var(--border-strong)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--surface)',
        ...style,
      }}
      {...rest}
    >
      <span
        className="mb-pattern-weave"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 56,
          height: 56,
          borderRadius: 'var(--radius)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: 'var(--muted)',
        }}
      >
        <Icon name={icon} size={26} />
      </span>
      {title && <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--text)' }}>{title}</h4>}
      {hint && <p style={{ margin: 0, maxWidth: '42ch', color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>{hint}</p>}
      {action && <div style={{ marginTop: 'var(--space-2)' }}>{action}</div>}
    </div>
  )
}
