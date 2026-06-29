// NPC roster store (B3). Loads npcs.json for the open campaign and writes through
// the repository on every edit, mirroring the campaign store's pattern. Kept
// separate from the campaign store so the overview page doesn't pay to load NPCs.

import { create } from 'zustand'
import type { NPC } from '../model/types'
import { data } from '../storage/data'
import { useActivity } from './activity'

interface NpcsState {
  campaignId: string | null
  npcs: NPC[]
  loading: boolean

  load: (campaignId: string) => Promise<void>
  add: (npc: NPC) => Promise<void>
  update: (id: string, patch: Partial<NPC>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useNpcs = create<NpcsState>((set, get) => ({
  campaignId: null,
  npcs: [],
  loading: false,

  load: async (campaignId) => {
    if (get().campaignId === campaignId && !get().loading) return
    set({ loading: true, campaignId, npcs: [] })
    const npcs = await data.readModuleArray<NPC>(campaignId, 'npcs')
    if (get().campaignId === campaignId) set({ npcs, loading: false })
  },

  add: async (npc) => {
    const { campaignId, npcs } = get()
    if (!campaignId) return
    const next = [...npcs, npc]
    set({ npcs: next })
    await data.writeModuleArray(campaignId, 'npcs', next)
    void useActivity.getState().log(campaignId, 'Added NPC', npc.name || '(unnamed)')
  },

  update: async (id, patch) => {
    const { campaignId, npcs } = get()
    if (!campaignId) return
    const next = npcs.map((n) => (n.id === id ? { ...n, ...patch } : n))
    set({ npcs: next })
    await data.writeModuleArray(campaignId, 'npcs', next)
    if ('dead' in patch) {
      const n = next.find((x) => x.id === id)
      void useActivity.getState().log(campaignId, patch.dead ? 'Marked NPC dead' : 'Revived NPC', n?.name)
    }
  },

  remove: async (id) => {
    const { campaignId, npcs } = get()
    if (!campaignId) return
    const target = npcs.find((n) => n.id === id)
    const next = npcs.filter((n) => n.id !== id)
    set({ npcs: next })
    await data.writeModuleArray(campaignId, 'npcs', next)
    if (target) void useActivity.getState().log(campaignId, 'Deleted NPC', target.name || '(unnamed)')
  },
}))
