import * as React from 'react'

export interface ToastProps {
  tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'accent'
  /** Override the tone's default Lucide icon. */
  icon?: string
  title?: string
  message?: string
  /** One inline action, e.g. `{ label: 'Отменить', onClick }`. */
  action?: { label: string; onClick: () => void }
  onClose?: () => void
  style?: React.CSSProperties
}

export function Toast(props: ToastProps): React.ReactElement
