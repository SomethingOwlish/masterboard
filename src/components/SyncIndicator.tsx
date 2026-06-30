// Small topbar badge reflecting the repository's sync state so the GM can tell
// whether edits are local-only, pushing, or stuck. Renders the design system's
// SyncBadge, mapping the repo's SyncState onto its visual states.

import { useEffect, useState } from 'react'
import { repo, type SyncState } from '../storage/repository'
import { useConfig } from '../store/config'
import { SyncBadge } from '../ds'

const STATE_MAP: Record<SyncState, 'syncing' | 'synced' | 'offline' | 'error'> = {
  idle: 'synced',
  syncing: 'syncing',
  error: 'error',
  offline: 'offline',
}

export function SyncIndicator() {
  const [state, setState] = useState<SyncState>(repo.getState())
  const isConnected = useConfig((s) => s.isConnected())

  useEffect(() => repo.onSync(setState), [])

  if (!isConnected) {
    return (
      <span title="Saved in this browser only">
        <SyncBadge state="local" />
      </span>
    )
  }

  if (state === 'error') {
    const detail = repo.getError() ?? 'Unknown error'
    return (
      <span
        role="button"
        tabIndex={0}
        title={detail}
        style={{ cursor: 'pointer' }}
        onClick={() => alert(`Sync error:\n\n${detail}\n\nYour work is still saved locally. Check Settings → Test connection.`)}
      >
        <SyncBadge state="error" />
      </span>
    )
  }

  return (
    <span title="GitHub sync status">
      <SyncBadge state={STATE_MAP[state]} />
    </span>
  )
}
