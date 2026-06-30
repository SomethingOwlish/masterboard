// App-wide toast notifications (save/sync/create/delete results). Mount
// <ToastHost /> once near the app root; call useToast()(toast) from anywhere.
// Bottom-right stack, auto-dismiss after a few seconds.

import { useEffect } from 'react'
import { create } from 'zustand'
import { Toast } from '../ds'

type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'accent'

export interface ToastInput {
  tone?: Tone
  title?: string
  message?: string
  icon?: string
  /** ms before auto-dismiss; 0 keeps it until dismissed. Default 4000. */
  duration?: number
}

interface ToastItem extends ToastInput {
  id: number
}

interface ToastState {
  items: ToastItem[]
  push: (t: ToastInput) => void
  dismiss: (id: number) => void
}

let nextId = 1

const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (t) => set((s) => ({ items: [...s.items, { ...t, id: nextId++ }] })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}))

export function useToast() {
  return useToastStore((s) => s.push)
}

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const duration = item.duration ?? 4000
  useEffect(() => {
    if (duration <= 0) return
    const t = setTimeout(() => onDismiss(item.id), duration)
    return () => clearTimeout(t)
  }, [duration, item.id, onDismiss])
  return (
    <Toast
      tone={item.tone}
      icon={item.icon}
      title={item.title}
      message={item.message}
      onClose={() => onDismiss(item.id)}
    />
  )
}

export function ToastHost() {
  const items = useToastStore((s) => s.items)
  const dismiss = useToastStore((s) => s.dismiss)
  if (items.length === 0) return null
  return (
    <div
      style={{
        position: 'fixed',
        right: 'var(--space-5)',
        bottom: 'var(--space-5)',
        zIndex: 'var(--z-toast)' as unknown as number,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
    >
      {items.map((item) => (
        <ToastRow key={item.id} item={item} onDismiss={dismiss} />
      ))}
    </div>
  )
}
