// App-wide confirm dialog. Replaces native window.confirm() with the design
// system's ConfirmDialog (scrim, blur, tone-aware icon). Mount <ConfirmHost />
// once near the app root; call useConfirm()(options) from anywhere.

import { create } from 'zustand'
import { ConfirmDialog } from '../ds'

export interface ConfirmOptions {
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'accent'
  icon?: string
  onConfirm: () => void
}

interface ConfirmState {
  current: ConfirmOptions | null
  open: (o: ConfirmOptions) => void
  close: () => void
}

const useConfirmStore = create<ConfirmState>((set) => ({
  current: null,
  open: (o) => set({ current: o }),
  close: () => set({ current: null }),
}))

export function useConfirm() {
  return useConfirmStore((s) => s.open)
}

export function ConfirmHost() {
  const current = useConfirmStore((s) => s.current)
  const close = useConfirmStore((s) => s.close)
  if (!current) return null
  return (
    <ConfirmDialog
      open
      title={current.title ?? 'Are you sure?'}
      message={current.message}
      confirmLabel={current.confirmLabel ?? 'Confirm'}
      cancelLabel={current.cancelLabel ?? 'Cancel'}
      tone={current.tone ?? 'danger'}
      icon={current.icon}
      onClose={close}
      onConfirm={() => {
        current.onConfirm()
        close()
      }}
    />
  )
}
