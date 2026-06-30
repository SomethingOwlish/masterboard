import React from 'react'
import { Icon } from './Icon'

/**
 * Tag — a chip for entity tags. Optionally removable (shows an x) or selectable
 * (filter pills). Pill shape, hairline border, surface-2 fill.
 */
export function Tag({ children, onRemove, selected = false, onClick, icon, style, ...rest }) {
  const interactive = !!onClick
  const [hover, setHover] = React.useState(false)
  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        paddingRight: onRemove ? 6 : 10,
        background: selected ? 'var(--accent-soft)' : hover && interactive ? 'var(--surface-3)' : 'var(--surface-2)',
        color: selected ? 'var(--accent)' : 'var(--text)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-pill)',
        fontFamily: 'var(--font-sans)',
        fontWeight: 'var(--weight-medium)',
        fontSize: 'var(--text-xs)',
        lineHeight: 1.4,
        cursor: interactive ? 'pointer' : 'default',
        transition: 'background var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out)',
        ...style,
      }}
      {...rest}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label="Remove tag"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: 'var(--muted)',
            cursor: 'pointer',
            borderRadius: '50%',
          }}
        >
          <Icon name="x" size={12} />
        </button>
      )}
    </span>
  )
}
