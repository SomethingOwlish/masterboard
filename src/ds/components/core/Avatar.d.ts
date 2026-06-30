import * as React from 'react'

export interface AvatarProps extends React.HTMLAttributes<HTMLElement> {
  /** Portrait image URL. Falls back to an icon tile when absent. */
  src?: string
  name?: string
  /** Fallback Lucide icon (e.g. "shield" for PCs, "drama" for NPCs). */
  icon?: string
  size?: number
  shape?: 'circle' | 'rounded'
  /** Dead state — greyscales and dims, swaps fallback to a skull. */
  dead?: boolean
  /** Accent ring around the avatar. */
  ring?: boolean
}

export function Avatar(props: AvatarProps): React.ReactElement
