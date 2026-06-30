import * as React from 'react'

export interface ModalProps {
  open?: boolean
  onClose?: () => void
  title?: string
  subtitle?: string
  /** Leading Lucide icon shown in a tinted tile. */
  icon?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Footer node(s) — typically Buttons. */
  footer?: React.ReactNode
  /** Allow Escape / scrim-click to close. Default true. */
  dismissable?: boolean
  children?: React.ReactNode
  style?: React.CSSProperties
}

export function Modal(props: ModalProps): React.ReactElement | null
