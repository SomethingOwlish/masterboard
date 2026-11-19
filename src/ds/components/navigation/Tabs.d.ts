import * as React from 'react'

export interface TabDef {
  id: string
  label: string
  icon?: string
  count?: number
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs: TabDef[]
  activeId?: string
  onSelect?: (id: string) => void
  /** Stable tab ids: `${idPrefix}-${tab.id}`, for panels' `aria-labelledby`. */
  idPrefix?: string
}

export function Tabs(props: TabsProps): React.ReactElement
