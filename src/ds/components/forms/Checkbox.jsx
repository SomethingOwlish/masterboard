import React from 'react'
import { Icon } from '../core/Icon'

/**
 * Checkbox — a labelled check with a custom box so it tints to accent and shows
 * a Lucide check when on. Used for "Dead", attendee checklists, directed edges.
 */
export function Checkbox({ checked = false, onChange, label, hint, disabled = false, id, style, ...rest }) {
  const fid = id || React.useId()
  return (
    <label
      htmlFor={fid}
      style={{
        display: 'inline-flex',
        alignItems: hint ? 'flex-start' : 'center',
        gap: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      <input
        id={fid}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
        {...rest}
      />
      <span
        aria-hidden="true"
        style={{
          width: 20,
          height: 20,
          flex: '0 0 auto',
          marginTop: hint ? 1 : 0,
          borderRadius: 'var(--radius-xs)',
          border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`,
          background: checked ? 'var(--accent)' : 'var(--surface)',
          color: 'var(--accent-text)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out)',
        }}
      >
        {checked && <Icon name="check" size={14} />}
      </span>
      {(label || hint) && (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {label && <span style={{ font: 'var(--type-ui)', color: 'var(--text)' }}>{label}</span>}
          {hint && <small style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>{hint}</small>}
        </span>
      )}
    </label>
  )
}
