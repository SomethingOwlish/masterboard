// App-wide confirm dialog. Replaces native window.confirm() with the design
// system's ConfirmDialog (scrim, blur, tone-aware icon). Mount <ConfirmHost />
// once near the app root; call useConfirm()(options) from anywhere.

import { create } from 'zustand'
import { ConfirmDialog } from '../ds'

export interface ConfirmOptions {
  title?: string
  message?: string
  /** Consequences, one per line (ТЗ-3, этап 5): what the action unlinks or changes. */
  items?: string[]
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
      title={current.title ?? 'Продолжить?'}
      message={current.message}
      items={current.items}
      confirmLabel={current.confirmLabel ?? 'Подтвердить'}
      cancelLabel={current.cancelLabel ?? 'Отмена'}
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
