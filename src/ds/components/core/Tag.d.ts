import * as React from 'react'

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** When provided, renders an x button that calls this. */
  onRemove?: () => void
  /** Filter-pill selected state. */
  selected?: boolean
  /** Leading Lucide icon name. */
  icon?: string
  children?: React.ReactNode
}

export function Tag(props: TagProps): React.ReactElement
