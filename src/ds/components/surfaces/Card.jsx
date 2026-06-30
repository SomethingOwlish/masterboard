import React from 'react'

/**
 * Card — the base surface container. Soft shadow, hairline border, generous
 * radius. `interactive` adds a hover lift + accent border (use for entity cards
 * and campaign tiles). `pattern` overlays a quiet texture; `glass` frosts it.
 */
export function Card({
  children,
  interactive = false,
  glass = false,
  pattern,
  padding = 'var(--space-5)',
  as = 'div',
  style,
  className = '',
  ...rest
}) {
  const [hover, setHover] = React.useState(false)
  const El = as
  const patternClass = pattern ? `mb-pattern-${pattern}` : ''

  return (
    <El
      onMouseEnter={interactive ? () => setHover(true) : undefined}
      onMouseLeave={interactive ? () => setHover(false) : undefined}
      className={`${glass ? 'mb-glass mb-sheen' : ''} ${patternClass} ${className}`.trim()}
      style={{
        background: glass ? undefined : 'var(--surface)',
        border: glass ? undefined : `1px solid ${interactive && hover ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: interactive && hover ? 'var(--shadow)' : 'var(--shadow-sm)',
        padding,
        transition: 'box-shadow var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out), transform var(--dur) var(--ease-out)',
        transform: interactive && hover ? 'translateY(-2px)' : 'none',
        ...style,
      }}
      {...rest}
    >
      {children}
    </El>
  )
}
