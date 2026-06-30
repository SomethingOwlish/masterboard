import * as React from 'react'

export interface StatBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: React.ReactNode
  hint?: string
  /** Accent tint — use for the headline metric. */
  accent?: boolean
}

export function StatBlock(props: StatBlockProps): React.ReactElement
