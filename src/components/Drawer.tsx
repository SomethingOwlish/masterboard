// Entity detail editor surface (Characters, NPCs, Locations, Misc, Tasks,
// Chronology). The app no longer uses a right-hand slide-over: clicking a card
// opens a centered MODAL instead. This wrapper keeps the historical name and
// prop shape (title / onClose / children / footer) so all call sites are
// unchanged while every editor now opens as a dialog over a blurred scrim.

import { type ReactNode } from 'react'
import { Modal } from '../ds'

export function Drawer({
  title,
  onClose,
  children,
  footer,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Modal open onClose={onClose} size="lg" title={typeof title === 'string' ? title : undefined} footer={footer}>
      {typeof title !== 'string' && title}
      <div className="mb-stack">{children}</div>
    </Modal>
  )
}
