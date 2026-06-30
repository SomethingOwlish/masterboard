import React from 'react'

/**
 * GlassPanel — a frosted floating surface for rails, inspectors, popovers and
 * toolbars. Translucent --glass fill, backdrop blur, hairline glass border and
 * a faint top sheen. Sits above patterned grounds so the texture reads through.
 */
export function GlassPanel({ children, veil = false, padding = 'var(--space-4)', radius = 'var(--radius-lg)', style, className = '', ...rest }) {
  return (
    <div
      className={`${veil ? 'mb-glass-veil' : 'mb-glass'} mb-sheen ${className}`.trim()}
      style={{
        borderRadius: radius,
        boxShadow: 'var(--shadow)',
        padding,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}
