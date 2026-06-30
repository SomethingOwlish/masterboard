import * as React from 'react'

export interface NavItemDef {
  id: string
  label: string
  /** Lucide icon name. */
  icon: string
  /** Optional trailing count/badge. */
  badge?: string | number
}

export interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: NavItemDef[]
  activeId?: string
  onSelect?: (id: string) => void
  header?: React.ReactNode
  footer?: React.ReactNode
  width?: number
}

export function SidebarNav(props: SidebarNavProps): React.ReactElement
