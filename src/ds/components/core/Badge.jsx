import React from 'react'
import { Icon } from './Icon'

/**
 * Badge — a small status marker. Soft tinted fill, optional leading dot or
 * icon. Use for sync state, "dead", counts, alive/dead filters.
 */
export function Badge({ children, tone = 'neutral', dot = false, icon, size = 'md', style, ...rest }) {
  const tones = {
    neutral: { bg: 'var(--surface-2)', fg: 'var(--muted)', dot: 'var(--muted)' },
    accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)', dot: 'var(--accent)' },
    success: { bg: 'var(--success-soft)', fg: 'var(--success)', dot: 'var(--success)' },
    danger: { bg: 'var(--danger-soft)', fg: 'var(--danger)', dot: 'var(--danger)' },
    warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', dot: 'var(--warning)' },
  }
  const t = tones[tone] || tones.neutral
  const pad = size === 'sm' ? '2px 8px' : '3px 10px'
  const fs = size === 'sm' ? 'var(--text-2xs)' : 'var(--text-xs)'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: pad,
        background: t.bg,
        color: t.fg,
        borderRadius: 'var(--radius-pill)',
        fontFamily: 'var(--font-sans)',
        fontWeight: 'var(--weight-semibold)',
        fontSize: fs,
        letterSpacing: '0.01em',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.dot, flex: '0 0 auto' }} />}
      {icon && <Icon name={icon} size={size === 'sm' ? 12 : 13} />}
      {children}
    </span>
  )
}
