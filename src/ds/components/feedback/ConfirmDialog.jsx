import React from 'react'
import { Modal } from './Modal'
import { Button } from '../core/Button'

/**
 * ConfirmDialog — a small Modal preset for destructive or consequential
 * actions ("Delete campaign?", "Remove relation?"). Tone-aware icon + confirm
 * button. Built on Modal so it inherits the scrim, blur and motion. `items`
 * lists the consequences under the message.
 */
export function ConfirmDialog({
  open = true,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  items,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  icon,
  busy = false,
}) {
  const defaultIcon = tone === 'danger' ? 'triangle-alert' : 'circle-help'
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      icon={icon || defaultIcon}
      title={title}
      footer={
        <>
          <Button variant="ghost" data-autofocus onClick={onClose}>{cancelLabel}</Button>
          <Button variant="primary" tone={tone === 'danger' ? 'danger' : 'accent'} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <p className="mb-modal__message">{message}</p>}
      {items?.length > 0 && (
        <ul className="mb-modal__list">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </Modal>
  )
}
