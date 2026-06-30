import React from 'react'

/**
 * Logo — the Masterboard lockup: a d6 "seal" tile (five pips in quincunx) in
 * the accent colour beside the Zen Old Mincho wordmark. Use `mark` for the
 * tile alone (collapsed rail, favicons, avatars).
 */
export function Logo({ size = 'md', mark = false, style, ...rest }) {
  const dims = { sm: 28, md: 38, lg: 52 }[size] || 38
  const radius = dims * 0.28
  const pad = dims * 0.2
  const pip = dims * 0.13
  const font = { sm: 18, md: 24, lg: 34 }[size] || 24

  const seal = (
    <span
      aria-hidden="true"
      style={{
        width: dims,
        height: dims,
        flex: '0 0 auto',
        borderRadius: radius,
        background: 'var(--accent)',
        boxShadow: 'var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.18)',
        display: 'grid',
        gridTemplateColumns: 'repeat(3,1fr)',
        gridTemplateRows: 'repeat(3,1fr)',
        padding: pad,
        boxSizing: 'border-box',
      }}
    >
      {[1, 0, 1, 0, 1, 0, 1, 0, 1].map((on, i) => (
        <span key={i} style={{ width: pip, height: pip, borderRadius: '50%', background: 'var(--accent-text)', visibility: on ? 'visible' : 'hidden', alignSelf: 'center', justifySelf: 'center' }} />
      ))}
    </span>
  )

  if (mark) return <span style={{ display: 'inline-flex', ...style }} {...rest}>{seal}</span>

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: dims * 0.3, ...style }} {...rest}>
      {seal}
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-medium)', fontSize: font, letterSpacing: 'var(--tracking-tight)', color: 'var(--text)', lineHeight: 1 }}>
        Master<span style={{ color: 'var(--accent)' }}>board</span>
      </span>
    </span>
  )
}
