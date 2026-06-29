// In-world chronology store (B4). timeline.json holds columns + events. The
// "Campaign" column is fixed (seeded on first load, never deletable). Events sit
// in a column ordered by an explicit `order` — seeded lexically by date on insert,
// then overridable by drag (DESIGN.md M6).

import { create } from 'zustand'
import { makeCampaignColumn, makeColumn } from '../model/defaults'
import { newId } from '../model/ids'
import type { ChronoColumn, ChronoEvent } from '../model/types'
import { data } from '../storage/data'
import { useActivity } from './activity'

interface ChronologyState {
  campaignId: string | null
  columns: ChronoColumn[]
  events: ChronoEvent[]
  loading: boolean

  load: (campaignId: string) => Promise<void>

  addColumn: (name: string) => Promise<void>
  renameColumn: (id: string, name: string) => Promise<void>
  toggleMinimize: (id: string) => Promise<void>
  moveColumn: (id: string, dir: -1 | 1) => Promise<void>
  removeColumn: (id: string) => Promise<void>

  addEvent: (input: { columnId: string; date: string; title: string; body?: string }) => Promise<void>
  updateEvent: (id: string, patch: Partial<ChronoEvent>) => Promise<void>
  removeEvent: (id: string) => Promise<void>
  /** Reorder one column's events to the given id order (drag result). */
  reorderColumn: (columnId: string, orderedIds: string[]) => Promise<void>
}

/** Renumber a column's events to 0..n following their current sort. */
function reindex(events: ChronoEvent[], columnId: string): ChronoEvent[] {
  const inCol = events.filter((e) => e.columnId === columnId).sort((a, b) => a.order - b.order)
  const order = new Map(inCol.map((e, i) => [e.id, i]))
  return events.map((e) => (order.has(e.id) ? { ...e, order: order.get(e.id)! } : e))
}

export const useChronology = create<ChronologyState>((set, get) => ({
  campaignId: null,
  columns: [],
  events: [],
  loading: false,

  load: async (campaignId) => {
    if (get().campaignId === campaignId && !get().loading) return
    set({ loading: true, campaignId, columns: [], events: [] })
    const doc = await data.readTimeline(campaignId)
    // Seed the fixed Campaign column the first time a campaign's chronology opens.
    let columns = doc.columns
    if (columns.length === 0) {
      columns = [makeCampaignColumn()]
      await data.writeTimeline(campaignId, { columns, events: doc.events })
    }
    if (get().campaignId === campaignId) set({ columns, events: doc.events, loading: false })
  },

  addColumn: async (name) => {
    const { campaignId, columns, events } = get()
    if (!campaignId || !name.trim()) return
    const order = columns.reduce((m, c) => Math.max(m, c.order), -1) + 1
    const next = [...columns, makeColumn(name, order)]
    set({ columns: next })
    await data.writeTimeline(campaignId, { columns: next, events })
    void useActivity.getState().log(campaignId, 'Added timeline column', name.trim())
  },

  renameColumn: async (id, name) => {
    const { campaignId, columns, events } = get()
    if (!campaignId || !name.trim()) return
    const next = columns.map((c) => (c.id === id ? { ...c, name: name.trim() } : c))
    set({ columns: next })
    await data.writeTimeline(campaignId, { columns: next, events })
  },

  toggleMinimize: async (id) => {
    const { campaignId, columns, events } = get()
    if (!campaignId) return
    const next = columns.map((c) => (c.id === id ? { ...c, minimized: !c.minimized } : c))
    set({ columns: next })
    await data.writeTimeline(campaignId, { columns: next, events })
  },

  moveColumn: async (id, dir) => {
    const { campaignId, columns, events } = get()
    if (!campaignId) return
    const sorted = [...columns].sort((a, b) => a.order - b.order)
    const i = sorted.findIndex((c) => c.id === id)
    const j = i + dir
    // The fixed column stays pinned at the far left; nothing swaps past it.
    if (i < 0 || j < 0 || j >= sorted.length || sorted[i].fixed || sorted[j].fixed) return
    ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
    const next = sorted.map((c, idx) => ({ ...c, order: idx }))
    set({ columns: next })
    await data.writeTimeline(campaignId, { columns: next, events })
  },

  removeColumn: async (id) => {
    const { campaignId, columns, events } = get()
    if (!campaignId) return
    const target = columns.find((c) => c.id === id)
    if (!target || target.fixed) return // the Campaign column can't be deleted
    const nextColumns = columns.filter((c) => c.id !== id).map((c, idx) => ({ ...c, order: idx }))
    const nextEvents = events.filter((e) => e.columnId !== id)
    set({ columns: nextColumns, events: nextEvents })
    await data.writeTimeline(campaignId, { columns: nextColumns, events: nextEvents })
    void useActivity.getState().log(campaignId, 'Removed timeline column', target.name)
  },

  addEvent: async ({ columnId, date, title, body }) => {
    const { campaignId, columns, events } = get()
    if (!campaignId) return
    const event: ChronoEvent = { id: newId('evt'), columnId, date, title, body, order: 0, links: [] }
    // Insert lexically by date among the column's current events, then renumber.
    const siblings = events.filter((e) => e.columnId === columnId).sort((a, b) => a.order - b.order)
    const at = siblings.findIndex((e) => e.date.localeCompare(date) > 0)
    const idx = at === -1 ? siblings.length : at
    siblings.splice(idx, 0, event)
    const newOrder = new Map(siblings.map((e, i) => [e.id, i]))
    const next = [...events, event].map((e) => (newOrder.has(e.id) ? { ...e, order: newOrder.get(e.id)! } : e))
    set({ events: next })
    await data.writeTimeline(campaignId, { columns, events: next })
    void useActivity.getState().log(campaignId, 'Added event', title || date)
  },

  updateEvent: async (id, patch) => {
    const { campaignId, columns, events } = get()
    if (!campaignId) return
    let next = events.map((e) => (e.id === id ? { ...e, ...patch } : e))
    // Moving to another column appends to the target's end.
    if (patch.columnId) {
      const max = next.filter((e) => e.columnId === patch.columnId && e.id !== id).reduce((m, e) => Math.max(m, e.order), -1)
      next = next.map((e) => (e.id === id ? { ...e, order: max + 1 } : e))
    }
    set({ events: next })
    await data.writeTimeline(campaignId, { columns, events: next })
  },

  removeEvent: async (id) => {
    const { campaignId, columns, events } = get()
    if (!campaignId) return
    const target = events.find((e) => e.id === id)
    const filtered = events.filter((e) => e.id !== id)
    const next = target ? reindex(filtered, target.columnId) : filtered
    set({ events: next })
    await data.writeTimeline(campaignId, { columns, events: next })
    if (target) void useActivity.getState().log(campaignId, 'Removed event', target.title || target.date)
  },

  reorderColumn: async (columnId, orderedIds) => {
    const { campaignId, columns, events } = get()
    if (!campaignId) return
    const rank = new Map(orderedIds.map((id, i) => [id, i]))
    const next = events.map((e) => (e.columnId === columnId && rank.has(e.id) ? { ...e, order: rank.get(e.id)! } : e))
    set({ events: next })
    await data.writeTimeline(campaignId, { columns, events: next })
  },
}))
