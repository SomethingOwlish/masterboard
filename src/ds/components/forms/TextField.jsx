import React from 'react'
import { Icon } from '../core/Icon'

/**
 * TextField — labelled text/number/textarea input with optional hint and a
 * leading Lucide icon. Hairline border, calm accent focus ring. The workhorse
 * of every drawer and the new-campaign wizard.
 */
export function TextField({
  label,
  hint,
  icon,
  multiline = false,
  rows = 3,
  invalid = false,
  id,
  style,
  containerStyle,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false)
  const fid = id || React.useId()
  const border = invalid ? 'var(--danger)' : focus ? 'var(--accent)' : 'var(--border)'

  const fieldStyle = {
    width: '100%',
    font: 'var(--type-body)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text)',
    background: 'var(--surface)',
    border: `1px solid ${border}`,
    borderRadius: 'var(--radius-sm)',
    padding: multiline ? '10px 12px' : '9px 12px',
    paddingLeft: icon && !multiline ? 36 : undefined,
    outline: 'none',
    boxShadow: focus ? '0 0 0 3px var(--ring)' : 'none',
    transition: 'border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out)',
    resize: multiline ? 'vertical' : undefined,
    fontFamily: 'var(--font-sans)',
    ...style,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...containerStyle }}>
      {label && (
        <label htmlFor={fid} style={{ font: 'var(--type-ui)', fontWeight: 'var(--weight-semibold)', color: 'var(--text)', fontSize: 'var(--text-xs)' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex' }}>
        {icon && !multiline && (
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}>
            <Icon name={icon} size={16} />
          </span>
        )}
        {multiline ? (
          <textarea id={fid} rows={rows} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} style={fieldStyle} {...rest} />
        ) : (
          <input id={fid} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} style={fieldStyle} {...rest} />
        )}
      </div>
      {hint && <small style={{ color: invalid ? 'var(--danger)' : 'var(--muted)', fontSize: 'var(--text-xs)' }}>{hint}</small>}
    </div>
  )
}
