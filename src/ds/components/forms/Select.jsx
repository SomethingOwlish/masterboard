import React from 'react'
import { Icon } from '../core/Icon'

/**
 * Select — labelled native select styled to match TextField. A chevron sits on
 * the trailing edge; the native menu stays accessible. Used for theme, system,
 * column and alive/dead filters.
 */
export function Select({ label, hint, value, onChange, children, id, invalid = false, style, containerStyle, ...rest }) {
  const [focus, setFocus] = React.useState(false)
  const fid = id || React.useId()
  const border = invalid ? 'var(--danger)' : focus ? 'var(--accent)' : 'var(--border)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...containerStyle }}>
      {label && (
        <label htmlFor={fid} style={{ font: 'var(--type-ui)', fontWeight: 'var(--weight-semibold)', color: 'var(--text)', fontSize: 'var(--text-xs)' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex' }}>
        <select
          id={fid}
          value={value}
          onChange={onChange}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            width: '100%',
            appearance: 'none',
            WebkitAppearance: 'none',
            font: 'var(--type-body)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-sans)',
            color: 'var(--text)',
            background: 'var(--surface)',
            border: `1px solid ${border}`,
            borderRadius: 'var(--radius-sm)',
            padding: '9px 36px 9px 12px',
            outline: 'none',
            boxShadow: focus ? '0 0 0 3px var(--ring)' : 'none',
            transition: 'border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out)',
            cursor: 'pointer',
            ...style,
          }}
          {...rest}
        >
          {children}
        </select>
        <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}>
          <Icon name="chevron-down" size={16} />
        </span>
      </div>
      {hint && <small style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>{hint}</small>}
    </div>
  )
}
