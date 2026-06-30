import React from 'react'
import { Icon } from '../core/Icon'

/**
 * SidebarNav — the campaign module rail. Glass surface, Lucide module icons,
 * an accent inset marker on the active item. Pass items {id,label,icon} and the
 * active id. Replaces the codebase's emoji burger menu.
 */
export function SidebarNav({ items = [], activeId, onSelect, header, footer, width = 240, style, ...rest }) {
  return (
    <aside
      className="mb-glass"
      style={{
        width,
        flex: `0 0 ${width}px`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderTop: 'none',
        borderBottom: 'none',
        borderLeft: 'none',
        ...style,
      }}
      {...rest}
    >
      {header && <div style={{ padding: 'var(--space-4) var(--space-4) var(--space-3)' }}>{header}</div>}
      <nav style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((m) => {
          const active = m.id === activeId
          return (
            <NavItem key={m.id} item={m} active={active} onClick={() => onSelect && onSelect(m.id)} />
          )
        })}
      </nav>
      {footer && <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--border)' }}>{footer}</div>}
    </aside>
  )
}

function NavItem({ item, active, onClick }) {
  const [hover, setHover] = React.useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        width: '100%',
        padding: '9px 12px',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        background: active ? 'var(--accent-soft)' : hover ? 'var(--surface-2)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text)',
        font: 'var(--type-ui)',
        fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-medium)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background var(--dur) var(--ease-out), color var(--dur) var(--ease-out)',
      }}
    >
      {active && <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, borderRadius: '0 3px 3px 0', background: 'var(--accent)' }} />}
      <Icon name={item.icon} size={18} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge != null && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--muted)' }}>{item.badge}</span>
      )}
    </button>
  )
}
