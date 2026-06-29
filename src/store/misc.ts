// Misc store (M9 / B6). Loads misc.json for the open campaign. Each Misc object
// carries a GM-defined `kind` (note / item / custom); the kind list itself lives
// in campaign.settings.miscKinds and is managed from the campaign store.

import { create } from 'zustand'
import type { Misc } from '../model/types'
import { data } from '../storage/data'
import { useActivity } from './activity'

interface MiscState {
  campaignId: string | null
  misc: Misc[]
  loading: boolean

  load: (campaignId: string) => Promise<void>
  add: (item: Misc) => Promise<void>
  update: (id: string, patch: Partial<Misc>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useMisc = create<MiscState>((set, get) => ({
  campaignId: null,
  misc: [],
  loading: false,

  load: async (campaignId) => {
    if (get().campaignId === campaignId && !get().loading) return
    set({ loading: true, campaignId, misc: [] })
    const misc = await data.readModuleArray<Misc>(campaignId, 'misc')
    if (get().campaignId === campaignId) set({ misc, loading: false })
  },

  add: async (item) => {
    const { campaignId, misc } = get()
    if (!campaignId) return
    const next = [...misc, item]
    set({ misc: next })
    await data.writeModuleArray(campaignId, 'misc', next)
    void useActivity.getState().log(campaignId, 'Added Misc', item.name || `(${item.kind})`)
  },

  update: async (id, patch) => {
    const { campaignId, misc } = get()
    if (!campaignId) return
    const next = misc.map((m) => (m.id === id ? { ...m, ...patch } : m))
    set({ misc: next })
    await data.writeModuleArray(campaignId, 'misc', next)
  },

  remove: async (id) => {
    const { campaignId, misc } = get()
    if (!campaignId) return
    const target = misc.find((m) => m.id === id)
    const next = misc.filter((m) => m.id !== id)
    set({ misc: next })
    await data.writeModuleArray(campaignId, 'misc', next)
    if (target) void useActivity.getState().log(campaignId, 'Deleted Misc', target.name || `(${target.kind})`)
  },
}))
