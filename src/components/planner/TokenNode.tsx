// An entity token on the session board (B11): a live reference to a PC / NPC /
// Location / Misc / Event, shown as a coloured chip. The name is resolved from the
// live entity pool (so renames flow through) and a token whose entity was deleted
// is flagged so the GM notices. Handles let tokens be wired into flow arrows.

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Icon } from '../../ds'
import { TOKEN_ICON, type TokenKind } from '../../lib/board'

export interface TokenData extends Record<string, unknown> {
  entityId: string
  entityKind: TokenKind
  name: string
  missing?: boolean
}

export function TokenNode({ data }: NodeProps) {
  const d = data as TokenData
  return (
    <div className={`token-node token-${d.entityKind}${d.missing ? ' token-missing' : ''}`}>
      <Handle type="target" position={Position.Left} className="token-handle" />
      <Icon name={TOKEN_ICON[d.entityKind] ?? 'dices'} size={14} />
      <span className="token-node-label">{d.missing ? '(removed)' : d.name || '(unnamed)'}</span>
      <Handle type="source" position={Position.Right} className="token-handle" />
    </div>
  )
}
