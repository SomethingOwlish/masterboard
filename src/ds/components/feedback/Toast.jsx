import React from 'react'
import { Icon } from '../core/Icon'

/**
 * Toast — a small floating notification for sync results, saves and errors.
 * Tone-coloured left rail + icon. Render one or stack several; pair with your
 * own timeout logic. Designed to sit bottom-right above content.
 */
export function Toast({ tone = 'neutral', icon, title, message, onClose, style, ...rest }) {
  const tones = {
    neutral: { c: 'var(--muted)', i: 'info' },
    success: { c: 'var(--success)', i: 'check' },
    danger: { c: 'var(--danger)', i: 'triangle-alert' },
    warning: { c: 'var(--warning)', i: 'refresh-cw' },
    accent: { c: 'var(--accent)', i: 'info' },
  }
  const t = tones[tone] || tones.neutral
  return (
    <div
      role="status"
      className="mb-sheen"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        width: 320,
        padding: 'var(--space-3) var(--space-4)',
        paddingLeft: 'var(--space-3)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${t.c}`,
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-lg)',
        animation: 'mbToastIn var(--dur-slow) var(--ease-out)',
        ...style,
      }}
      {...rest}
    >
      <span style={{ color: t.c, marginTop: 1, flex: '0 0 auto' }}>
        <Icon name={icon || t.i} size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ font: 'var(--type-ui)', fontWeight: 'var(--weight-semibold)', color: 'var(--text)' }}>{title}</div>}
        {message && <div style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)', marginTop: 1 }}>{message}</div>}
      </div>
      {onClose && (
        <button type="button" aria-label="Dismiss" onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 2, display: 'inline-flex', marginTop: -1 }}>
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  )
}
