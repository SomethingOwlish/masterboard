// Right-side slide-over used for entity detail editing (Characters, NPCs, …).
// Thin wrapper over the design system's Drawer, preserving this app's existing
// prop shape (title / onClose / children / footer) so call sites are unchanged.

import { type ReactNode } from 'react'
import { Drawer as DsDrawer } from '../ds'

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
    <DsDrawer open onClose={onClose} title={typeof title === 'string' ? title : undefined} footer={footer}>
      {typeof title !== 'string' && title}
      {children}
    </DsDrawer>
  )
}
