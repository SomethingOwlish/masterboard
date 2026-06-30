import React from 'react'
import { Icon } from '../core/Icon'

/**
 * Tabs — a calm underline tab strip for switching views (e.g. alive/dead, or a
 * settings section). Active tab carries an accent underline that slides.
 */
export function Tabs({ tabs = [], activeId, onSelect, style, ...rest }) {
  return (
    <div
      role="tablist"
      style={{ display: 'inline-flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--border)', ...style }}
      {...rest}
    >
      {tabs.map((t) => {
        const active = t.id === activeId
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect && onSelect(t.id)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 14px',
              border: 'none',
              background: 'transparent',
              color: active ? 'var(--text)' : 'var(--muted)',
              font: 'var(--type-ui)',
              fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-medium)',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t.icon && <Icon name={t.icon} size={16} />}
            {t.label}
            {t.count != null && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--muted)' }}>{t.count}</span>
            )}
            <span
              style={{
                position: 'absolute',
                left: 6,
                right: 6,
                bottom: -1,
                height: 2,
                borderRadius: '2px 2px 0 0',
                background: active ? 'var(--accent)' : 'transparent',
                transition: 'background var(--dur) var(--ease-out)',
              }}
            />
          </button>
        )
      })}
    </div>
  )
}
