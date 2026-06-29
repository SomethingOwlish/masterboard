// Per-campaign activity log (changelog). `log()` is called from the campaign and
// hub stores whenever a meaningful, discrete change happens — it appends a
// timestamped entry and persists it. The Log page reads `entries` for the open
// campaign; logging into the open campaign updates `entries` live.

import { create } from 'zustand'
import { newId } from '../model/ids'
import type { ActivityEntry } from '../model/types'
import { data } from '../storage/data'

const MAX_ENTRIES = 1000

interface ActivityState {
  campaignId: string | null
  entries: ActivityEntry[]
  loading: boolean
  load: (campaignId: string) => Promise<void>
  log: (campaignId: string, action: string, detail?: string) => Promise<void>
  clear: (campaignId: string) => Promise<void>
}

export const useActivity = create<ActivityState>((set, get) => ({
  campaignId: null,
  entries: [],
  loading: false,

  load: async (campaignId) => {
    set({ loading: true, campaignId })
    const entries = await data.readActivity(campaignId)
    // Only apply if the user hasn't navigated away mid-load.
    if (get().campaignId === campaignId) set({ entries, loading: false })
  },

  log: async (campaignId, action, detail) => {
    const entry: ActivityEntry = { id: newId('act'), at: new Date().toISOString(), action, detail }
    // Use live state when this is the open campaign; otherwise read from storage.
    const base = get().campaignId === campaignId ? get().entries : await data.readActivity(campaignId)
    const next = [entry, ...base].slice(0, MAX_ENTRIES)
    if (get().campaignId === campaignId) set({ entries: next })
    await data.writeActivity(campaignId, next)
  },

  clear: async (campaignId) => {
    if (get().campaignId === campaignId) set({ entries: [] })
    await data.writeActivity(campaignId, [])
  },
}))
