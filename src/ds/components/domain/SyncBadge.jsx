import React from 'react'
import { Badge } from '../core/Badge'

/**
 * SyncBadge — the storage-state pill in the topbar. Maps Masterboard's sync
 * states (local / syncing / synced / offline / error) to a tone, icon and copy.
 */
export function SyncBadge({ state = 'local', at, style }) {
  const map = {
    local: { tone: 'neutral', icon: 'hard-drive', text: 'Local only' },
    syncing: { tone: 'warning', icon: 'refresh-cw', text: 'Syncing…' },
    synced: { tone: 'success', icon: 'check', text: at ? `Synced · ${at}` : 'Synced' },
    offline: { tone: 'neutral', icon: 'cloud-off', text: 'Offline' },
    error: { tone: 'danger', icon: 'triangle-alert', text: 'Sync error' },
  }
  const s = map[state] || map.local
  return <Badge tone={s.tone} icon={s.icon} style={style}>{s.text}</Badge>
}
