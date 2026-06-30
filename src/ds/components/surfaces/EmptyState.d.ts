import * as React from 'react'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Lucide icon name. */
  icon?: string
  title?: string
  hint?: string
  /** Action node, e.g. a <Button>. */
  action?: React.ReactNode
}

export function EmptyState(props: EmptyStateProps): React.ReactElement
