import * as React from 'react'

export interface ChronoEventProps extends React.HTMLAttributes<HTMLElement> {
  /** Free-text in-world date, e.g. "3rd of Harvest, 1024". */
  date?: string
  title?: string
  body?: string
  dragging?: boolean
  onClick?: () => void
}

export function ChronoEvent(props: ChronoEventProps): React.ReactElement
