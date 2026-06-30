import * as React from 'react'

export interface RecapItemProps extends React.HTMLAttributes<HTMLElement> {
  /** Session sequence number. */
  seq?: number
  /** Real-world date string. */
  date?: string
  title?: string
  body?: string
  onOpen?: () => void
}

export function RecapItem(props: RecapItemProps): React.ReactElement
