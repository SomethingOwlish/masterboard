import React from 'react'
import { Icon } from '../core/Icon'

/**
 * RecapItem — one entry in the session-recap log (the campaign chronicle as
 * prose). Sequence chip, real date, title and body. Reverse-chronological list.
 */
export function RecapItem({ seq, date, title, body, onOpen, style, ...rest }) {
  return (
    <article
      style={{
        padding: 'var(--space-4)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        ...style,
      }}
      {...rest}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 6 }}>
        {seq != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 30, height: 24, padding: '0 8px', borderRadius: 'var(--radius-pill)', background: 'var(--accent-soft)', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)' }}>
            #{seq}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ font: 'var(--type-card-title)', color: 'var(--text)' }}>{title || 'Session recap'}</strong>
          {date && <div className="mb-data" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{date}</div>}
        </div>
        {onOpen && (
          <button type="button" aria-label="Open session" onClick={onOpen} style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', display: 'inline-flex', padding: 4 }}>
            <Icon name="arrow-right" size={16} />
          </button>
        )}
      </header>
      {body && <p style={{ margin: 0, color: 'var(--muted)', fontSize: 'var(--text-sm)', lineHeight: 1.55 }}>{body}</p>}
    </article>
  )
}
