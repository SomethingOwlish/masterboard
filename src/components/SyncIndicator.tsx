// Small topbar badge reflecting the repository's sync state so the GM can tell
// whether edits are local-only, pushing, or stuck.

import { useEffect, useState } from 'react'
import { repo, type SyncState } from '../storage/repository'
import { useConfig } from '../store/config'

const LABEL: Record<SyncState, string> = {
  idle: 'Synced',
  syncing: 'Syncing…',
  error: 'Sync error',
  offline: 'Offline',
}

export function SyncIndicator() {
  const [state, setState] = useState<SyncState>(repo.getState())
  const isConnected = useConfig((s) => s.isConnected())

  useEffect(() => repo.onSync(setState), [])

  if (!isConnected) return <span className="sync-badge local" title="Saved in this browser only">Local</span>

  return (
    <span className={`sync-badge ${state}`} title="GitHub sync status">
      {LABEL[state]}
    </span>
  )
}
