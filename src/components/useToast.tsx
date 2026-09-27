// App-wide toast notifications (save/sync/create/delete results). Mount
// <ToastHost /> once near the app root; call useToast()(toast) from anywhere
// (or `pushToast` / `removeWithUndo` from ./toast outside React).
// Bottom-right stack, auto-dismiss after a few seconds; the timer pauses while
// the pointer or focus is on the toast.

import { useEffect, useState } from 'react'
import { Toast } from '../ds'
import { UNDO_MS, useToastStore, type ToastItem } from './toast'

export function useToast() {
  return useToastStore((s) => s.push)
}

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const duration = item.duration ?? (item.action ? UNDO_MS : 4000)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (duration <= 0 || paused) return
    const t = setTimeout(() => onDismiss(item.id), duration)
    return () => clearTimeout(t)
  }, [duration, paused, item.id, onDismiss])
  const action = item.action && { label: item.action.label, onClick: () => { onDismiss(item.id); item.action?.onClick() } }
  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Toast
        tone={item.tone}
        icon={item.icon}
        title={item.title}
        message={item.message}
        action={action}
        onClose={() => onDismiss(item.id)}
      />
    </div>
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
