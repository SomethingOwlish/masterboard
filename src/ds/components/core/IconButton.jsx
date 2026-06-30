import React from 'react'
import { Icon } from './Icon'

/**
 * IconButton — a square, icon-only control for toolbars, card corners and
 * drawer headers. Same press feel as Button. Always pass an accessible label.
 */
export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  tone = 'default',
  disabled = false,
  style,
  ...rest
}) {
  const dims = { sm: 28, md: 34, lg: 40 }[size] || 34
  const ic = { sm: 15, md: 18, lg: 20 }[size] || 18
  const [hover, setHover] = React.useState(false)

  const toneColor = tone === 'danger' ? 'var(--danger)' : tone === 'accent' ? 'var(--accent)' : 'var(--text)'

  const variants = {
    ghost: { background: hover && !disabled ? 'var(--surface-2)' : 'transparent', color: toneColor, border: '1px solid transparent' },
    solid: { background: hover && !disabled ? 'var(--surface-2)' : 'var(--surface)', color: toneColor, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' },
    soft: { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid transparent' },
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: dims,
        height: dims,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background var(--dur) var(--ease-out), color var(--dur) var(--ease-out)',
        ...variants[variant],
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={ic} />
    </button>
  )
}
