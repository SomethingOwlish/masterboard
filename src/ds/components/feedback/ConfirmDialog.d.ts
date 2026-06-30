import * as React from 'react'

export interface ConfirmDialogProps {
  open?: boolean
  onClose?: () => void
  onConfirm?: () => void
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'accent'
  icon?: string
  busy?: boolean
}

export function ConfirmDialog(props: ConfirmDialogProps): React.ReactElement | null
