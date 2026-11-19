import React from 'react'
import { Icon } from '../core/Icon'

/**
 * Tabs — a calm underline tab strip for switching views (e.g. alive/dead, or a
 * settings section). Active tab carries an accent underline that slides.
 *
 * Keyboard (WAI-ARIA tabs): only the active tab is in the tab order; ←/→ move
 * to the previous/next tab and select it, Home/End jump to the first/last.
 * `idPrefix` gives tabs stable ids (`${idPrefix}-${id}`) so panels can point
 * back with `aria-labelledby`.
 */
export function Tabs({ tabs = [], activeId, onSelect, idPrefix, style, ...rest }) {
  const refs = React.useRef({})
  const select = (index) => {
    const tab = tabs[(index + tabs.length) % tabs.length]
    if (!tab) return
    onSelect && onSelect(tab.id)
    refs.current[tab.id] && refs.current[tab.id].focus()
  }
  const onKeyDown = (event) => {
    const at = tabs.findIndex((t) => t.id === activeId)
    if (event.key === 'ArrowRight') select(at + 1)
    else if (event.key === 'ArrowLeft') select(at - 1)
    else if (event.key === 'Home') select(0)
    else if (event.key === 'End') select(tabs.length - 1)
    else return
    event.preventDefault()
  }
  return (
    <div
      role="tablist"
      style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 'var(--space-1)', borderBottom: '1px solid var(--border)', ...style }}
      onKeyDown={onKeyDown}
      {...rest}
    >
      {tabs.map((t) => {
        const active = t.id === activeId
        return (
          <button
            key={t.id}
            ref={(node) => { refs.current[t.id] = node }}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-${t.id}` : undefined}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
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
              aria-hidden="true"
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
