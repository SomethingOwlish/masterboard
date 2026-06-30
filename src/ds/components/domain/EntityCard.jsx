import React from 'react'
import { Avatar } from '../core/Avatar'
import { Tag } from '../core/Tag'
import { Badge } from '../core/Badge'

/**
 * EntityCard — a character or NPC card for the roster grids. Avatar + name +
 * secondary line (player name, or a dead badge) + tag chips. `kind` switches
 * the avatar shape/icon; `dead` greys it. Hover lifts and accents the border.
 */
export function EntityCard({ name, secondary, portrait, kind = 'pc', dead = false, tags = [], onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false)
  const icon = kind === 'npc' ? 'drama' : 'shield'
  const shape = kind === 'npc' ? 'rounded' : 'circle'

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        alignItems: 'stretch',
        textAlign: 'left',
        padding: 'var(--space-4)',
        background: 'var(--surface)',
        border: `1px solid ${hover ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: hover ? 'var(--shadow)' : 'var(--shadow-sm)',
        transform: hover ? 'translateY(-2px)' : 'none',
        opacity: dead ? 0.72 : 1,
        cursor: 'pointer',
        transition: 'box-shadow var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out), transform var(--dur) var(--ease-out)',
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <Avatar src={portrait} name={name} icon={icon} shape={shape} dead={dead} size={40} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ display: 'block', font: 'var(--type-card-title)', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name || '(unnamed)'}
          </strong>
          {dead ? (
            <Badge tone="danger" icon="skull" size="sm">Dead</Badge>
          ) : (
            secondary && <span style={{ font: 'var(--type-meta)', color: 'var(--muted)' }}>{secondary}</span>
          )}
        </div>
      </div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map((t) => <Tag key={t}>{t}</Tag>)}
        </div>
      )}
    </button>
  )
}
