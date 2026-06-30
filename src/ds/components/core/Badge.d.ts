import * as React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'warning'
  /** Show a leading status dot. */
  dot?: boolean
  /** Leading Lucide icon name. */
  icon?: string
  size?: 'sm' | 'md'
  children?: React.ReactNode
}

export function Badge(props: BadgeProps): React.ReactElement
