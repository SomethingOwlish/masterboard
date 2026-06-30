import React from 'react'

/**
 * Switch — a soft sliding toggle for binary settings (minimize column, storage
 * overrides, sync on/off). Accent track when on, calm 200ms ease, no bounce.
 */
export function Switch({ checked = false, onChange, label, disabled = false, id, style, ...rest }) {
  const fid = id || React.useId()
  return (
    <label
      htmlFor={fid}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, ...style }}
    >
      <input
        id={fid}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
        {...rest}
      />
      <span
        aria-hidden="true"
        style={{
          width: 40,
          height: 23,
          flex: '0 0 auto',
          borderRadius: 'var(--radius-pill)',
          background: checked ? 'var(--accent)' : 'var(--surface-3)',
          border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`,
          position: 'relative',
          transition: 'background var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 19 : 2,
            width: 17,
            height: 17,
            borderRadius: '50%',
            background: checked ? 'var(--accent-text)' : 'var(--surface)',
            boxShadow: 'var(--shadow-sm)',
            transition: 'left var(--dur) var(--ease-out), background var(--dur) var(--ease-out)',
          }}
        />
      </span>
      {label && <span style={{ font: 'var(--type-ui)', color: 'var(--text)' }}>{label}</span>}
    </label>
  )
}
