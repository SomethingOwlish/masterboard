import * as React from 'react'

export interface SyncBadgeProps {
  state?: 'local' | 'syncing' | 'synced' | 'offline' | 'error'
  /** Timestamp shown for the synced state, e.g. "14:08". */
  at?: string
  style?: React.CSSProperties
}

export function SyncBadge(props: SyncBadgeProps): React.ReactElement
