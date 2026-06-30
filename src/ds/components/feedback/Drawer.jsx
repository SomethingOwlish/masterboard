import React from 'react'
import { IconButton } from '../core/IconButton'

/**
 * Drawer — a right-hand slide-over for entity detail editing (characters, NPCs,
 * chrono events). Scrim with blur, glass header, sticky footer for actions.
 * The primary editing surface across the app's modules.
 */
export function Drawer({ open = true, onClose, title, subtitle, width = 460, children, footer, style, ...rest }) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape' && onClose) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      onMouseDown={(e) => { if (onClose && e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)',
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'color-mix(in oklab, var(--bg) 35%, rgba(0,0,0,0.45))',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'mbFade var(--dur) var(--ease-out)',
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: '100%',
          maxWidth: width,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          animation: 'mbSlideIn var(--dur-slow) var(--ease-out)',
          ...style,
        }}
        {...rest}
      >
        <header
          className="mb-glass mb-sheen"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border)', borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h3>}
            {subtitle && <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>{subtitle}</p>}
          </div>
          {onClose && <IconButton icon="x" label="Close" onClick={onClose} />}
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>{children}</div>
        {footer && (
          <footer style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            {footer}
          </footer>
        )}
      </aside>
    </div>
  )
}
