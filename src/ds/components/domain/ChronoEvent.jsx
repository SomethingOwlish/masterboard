import React from 'react'

/**
 * ChronoEvent — an in-world timeline event card for the chronology columns.
 * Mono date stamp, display-leaning title, clamped body. Hover accents the
 * border; `dragging` dims it. Drops onto a column on the row matching its date.
 */
export function ChronoEvent({ date, title, body, onClick, dragging = false, style, ...rest }) {
  const [hover, setHover] = React.useState(false)
  return (
    <article
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: 'var(--space-3)',
        background: 'var(--surface-2)',
        border: `1px solid ${hover ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        opacity: dragging ? 0.4 : 1,
        transition: 'border-color var(--dur) var(--ease-out)',
        ...style,
      }}
      {...rest}
    >
      <div className="mb-data" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{date || '—'}</div>
      <strong style={{ display: 'block', marginTop: 3, font: 'var(--type-card-title)', fontSize: 'var(--text-base)', color: 'var(--text)' }}>
        {title || '(untitled)'}
      </strong>
      {body && (
        <p
          style={{
            margin: '5px 0 0',
            color: 'var(--muted)',
            fontSize: 'var(--text-sm)',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {body}
        </p>
      )}
    </article>
  )
}
