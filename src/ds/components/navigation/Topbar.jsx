import React from 'react'

/**
 * Topbar — the sticky glass header for a campaign view. Holds the campaign
 * title (display serif), a slot for status (SyncBadge) and the ThemeSwitcher.
 * Translucent so the patterned ground reads beneath as you scroll.
 */
export function Topbar({ title, left, right, style, ...rest }) {
  return (
    <header
      className="mb-glass mb-sheen"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-5)',
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-rail)',
        ...style,
      }}
      {...rest}
    >
      {left}
      {title && (
        <strong style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </strong>
      )}
      {!title && <span style={{ flex: 1 }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>{right}</div>
    </header>
  )
}
