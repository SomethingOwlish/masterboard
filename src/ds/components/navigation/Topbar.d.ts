import * as React from 'react'

export interface TopbarProps extends React.HTMLAttributes<HTMLElement> {
  title?: string
  /** Left slot (e.g. a menu IconButton on mobile). */
  left?: React.ReactNode
  /** Right slot (SyncBadge, ThemeSwitcher). */
  right?: React.ReactNode
}

export function Topbar(props: TopbarProps): React.ReactElement
