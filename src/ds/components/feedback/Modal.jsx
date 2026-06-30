import React from 'react'
import { IconButton } from '../core/IconButton'
import { Icon } from '../core/Icon'

/**
 * Modal — a centered dialog over a blurred scrim. The Masterboard surface for
 * the campaign wizard, quick-add forms, command palette and confirmations.
 * Glass header sheen, calm scale-in, Escape + scrim-click to dismiss. Sizes
 * sm | md | lg | xl. Compose ModalFooter for actions.
 */
export function Modal({ open = true, onClose, title, subtitle, icon, size = 'md', children, footer, dismissable = true, style, ...rest }) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape' && dismissable && onClose) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, dismissable])

  if (!open) return null
  const widths = { sm: 380, md: 480, lg: 620, xl: 820 }
  const w = widths[size] || widths.md

  return (
    <div
      onMouseDown={(e) => { if (dismissable && onClose && e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-5)',
        background: 'color-mix(in oklab, var(--bg) 40%, rgba(0,0,0,0.5))',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'mbFade var(--dur) var(--ease-out)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="mb-sheen"
        style={{
          width: '100%',
          maxWidth: w,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          animation: 'mbPop var(--dur-slow) var(--ease-out)',
          ...style,
        }}
        {...rest}
      >
        {(title || icon) && (
          <header style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', padding: 'var(--space-5) var(--space-5) var(--space-4)' }}>
            {icon && (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, flex: '0 0 auto', borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                <Icon name={icon} size={20} />
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {title && <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-xl)', color: 'var(--text)', lineHeight: 1.2 }}>{title}</h3>}
              {subtitle && <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>{subtitle}</p>}
            </div>
            {dismissable && onClose && <IconButton icon="x" label="Close" onClick={onClose} />}
          </header>
        )}
        <div style={{ padding: title ? '0 var(--space-5) var(--space-5)' : 'var(--space-5)', overflowY: 'auto' }}>{children}</div>
        {footer && (
          <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
