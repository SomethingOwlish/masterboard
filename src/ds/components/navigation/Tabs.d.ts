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
}

export function Tabs(props: TabsProps): React.ReactElement
