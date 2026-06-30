import React from 'react'
import { Icon } from './Icon'

/**
 * Button — the primary action control. Calm fills, hairline borders, a soft
 * press. Variants map to Masterboard's surface system; tones recolour for
 * destructive or success actions. Optional leading/trailing Lucide icons.
 */
export function Button({
  children,
  variant = 'secondary',
  tone = 'accent',
  size = 'md',
  icon,
  iconRight,
  block = false,
  disabled = false,
  type = 'button',
  style,
  ...rest
}) {
  const sizes = {
    sm: { padding: '6px 12px', font: 'var(--text-sm)', gap: 6, ic: 15, radius: 'var(--radius-sm)' },
    md: { padding: '9px 16px', font: 'var(--text-sm)', gap: 8, ic: 17, radius: 'var(--radius-sm)' },
    lg: { padding: '12px 22px', font: 'var(--text-base)', gap: 9, ic: 19, radius: 'var(--radius)' },
  }
  const s = sizes[size] || sizes.md

  const toneColor = {
    accent: 'var(--accent)',
    danger: 'var(--danger)',
    success: 'var(--success)',
  }[tone] || 'var(--accent)'

  const base = {
    display: block ? 'flex' : 'inline-flex',
    width: block ? '100%' : undefined,
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.gap,
    padding: s.padding,
    fontFamily: 'var(--font-sans)',
    fontWeight: 'var(--weight-semibold)',
    fontSize: s.font,
    lineHeight: 1.1,
    letterSpacing: '0.005em',
    borderRadius: s.radius,
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur) var(--ease-out)',
    whiteSpace: 'nowrap',
  }

  const variants = {
    primary: { background: toneColor, color: 'var(--accent-text)', boxShadow: 'var(--shadow-sm)' },
    secondary: { background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' },
    soft: { background: tone === 'accent' ? 'var(--accent-soft)' : `var(--${tone}-soft)`, color: toneColor },
    ghost: { background: 'transparent', color: 'var(--text)' },
    outline: { background: 'transparent', color: toneColor, borderColor: 'currentColor' },
  }

  const [hover, setHover] = React.useState(false)
  const [active, setActive] = React.useState(false)
  const hoverStyle = !disabled && hover ? hoverFor(variant, toneColor) : null
  const activeStyle = !disabled && active ? { transform: 'translateY(0.5px) scale(0.99)' } : null

  return (
    <button
      type={type}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false) }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{ ...base, ...variants[variant], ...hoverStyle, ...activeStyle, ...style }}
      {...rest}
    >
      {icon && <Icon name={icon} size={s.ic} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={s.ic} />}
    </button>
  )
}

function hoverFor(variant, tone) {
  switch (variant) {
    case 'primary': return { filter: 'brightness(1.06)', boxShadow: 'var(--shadow)' }
    case 'secondary': return { borderColor: 'var(--border-strong)', background: 'var(--surface-2)' }
    case 'soft': return { filter: 'brightness(0.98)' }
    case 'ghost': return { background: 'var(--surface-2)' }
    case 'outline': return { background: tone, color: 'var(--accent-text)' }
    default: return null
  }
}
