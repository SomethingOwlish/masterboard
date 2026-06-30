import * as React from 'react'

export interface DrawerProps {
  open?: boolean
  onClose?: () => void
  title?: string
  subtitle?: string
  /** Max width in px. Default 460. */
  width?: number
  footer?: React.ReactNode
  children?: React.ReactNode
  style?: React.CSSProperties
}

export function Drawer(props: DrawerProps): React.ReactElement | null
