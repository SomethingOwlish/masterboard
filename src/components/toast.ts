// Toast store and helpers usable outside React. The host and the hook are in useToast.tsx.

import { create } from 'zustand'
import { currentCampaign } from '../local/latestCampaign'
import type { LocalCampaignRecord } from '../local/types'
import { restoreRemoved } from '../local/undo'

type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'accent'

export interface ToastInput {
  tone?: Tone
  title?: string
  message?: string
  icon?: string
  /** ms before auto-dismiss; 0 keeps it until dismissed. Default 4000, 8000 with an action. */
  duration?: number
  /** One button on the toast; pressing it runs `onClick` and closes the toast. */
  action?: { label: string; onClick: () => void }
  /** Groups toasts that `dismissToasts(scope)` closes together (e.g. one campaign's undo toasts). */
  scope?: string
}

export interface ToastItem extends ToastInput {
  id: number
}

interface ToastState {
  items: ToastItem[]
  push: (t: ToastInput) => number
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (t) => {
    const id = nextId++
    set((s) => ({ items: [...s.items, { ...t, id }] }))
    return id
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}))

/** Shows a toast outside React (helpers, callbacks). */
export const pushToast = (t: ToastInput) => useToastStore.getState().push(t)

/** Closes every toast of a scope. */
export function dismissToasts(scope: string) {
  useToastStore.setState((s) => ({ items: s.items.filter((i) => i.scope !== scope) }))
}

export const UNDO_MS = 8000
export const campaignScope = (campaignId: string) => `campaign:${campaignId}`

/**
 * Simple deletes (ТЗ-3, этап 5): writes `after` at once and offers «Отменить»
 * for ~8 s. Undo puts back what `before` had and `after` lost, keeping edits
 * made in the meantime; leaving the campaign closes the toast.
 */
export function removeWithUndo(persist: (next: LocalCampaignRecord) => void, before: LocalCampaignRecord, after: LocalCampaignRecord, label: string) {
  persist(after)
  pushToast({
    title: 'Удалено',
    message: label,
    icon: 'trash-2',
    duration: UNDO_MS,
    scope: campaignScope(after.id),
    action: { label: 'Отменить', onClick: () => persist(restoreRemoved(before, after, currentCampaign(after.id) ?? after)) },
  })
}
