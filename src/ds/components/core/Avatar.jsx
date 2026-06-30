import React from 'react'
import { Icon } from './Icon'

/**
 * Avatar — a portrait for characters/NPCs. Falls back to a Lucide glyph on a
 * tinted tile when no image. Supports circle (PCs) or rounded-square (NPCs),
 * a dead/greyed state, and a small accent ring.
 */
export function Avatar({ src, name = '', icon = 'shield', size = 40, shape = 'circle', dead = false, ring = false, style, ...rest }) {
  const radius = shape === 'circle' ? '50%' : 'var(--radius-sm)'
  const common = {
    width: size,
    height: size,
    borderRadius: radius,
    flex: '0 0 auto',
    objectFit: 'cover',
    filter: dead ? 'grayscale(1)' : 'none',
    opacity: dead ? 0.65 : 1,
    boxShadow: ring ? '0 0 0 2px var(--surface), 0 0 0 3.5px var(--accent)' : 'none',
    ...style,
  }
  if (src) {
    return <img src={src} alt={name} style={common} {...rest} />
  }
  return (
    <span
      title={name}
      style={{
        ...common,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        color: 'var(--muted)',
      }}
      {...rest}
    >
      <Icon name={dead ? 'skull' : icon} size={Math.round(size * 0.5)} />
    </span>
  )
}
