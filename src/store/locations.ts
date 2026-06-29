// Locations store (M8 / B6). Loads locations.json for the open campaign and writes
// through the repository on every edit, mirroring the NPCs store pattern.

import { create } from 'zustand'
import type { Location } from '../model/types'
import { data } from '../storage/data'
import { useActivity } from './activity'

interface LocationsState {
  campaignId: string | null
  locations: Location[]
  loading: boolean

  load: (campaignId: string) => Promise<void>
  add: (location: Location) => Promise<void>
  update: (id: string, patch: Partial<Location>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useLocations = create<LocationsState>((set, get) => ({
  campaignId: null,
  locations: [],
  loading: false,

  load: async (campaignId) => {
    if (get().campaignId === campaignId && !get().loading) return
    set({ loading: true, campaignId, locations: [] })
    const locations = await data.readModuleArray<Location>(campaignId, 'locations')
    if (get().campaignId === campaignId) set({ locations, loading: false })
  },

  add: async (location) => {
    const { campaignId, locations } = get()
    if (!campaignId) return
    const next = [...locations, location]
    set({ locations: next })
    await data.writeModuleArray(campaignId, 'locations', next)
    void useActivity.getState().log(campaignId, 'Added location', location.name || '(unnamed)')
  },

  update: async (id, patch) => {
    const { campaignId, locations } = get()
    if (!campaignId) return
    const next = locations.map((l) => (l.id === id ? { ...l, ...patch } : l))
    set({ locations: next })
    await data.writeModuleArray(campaignId, 'locations', next)
  },

  remove: async (id) => {
    const { campaignId, locations } = get()
    if (!campaignId) return
    const target = locations.find((l) => l.id === id)
    const next = locations.filter((l) => l.id !== id)
    set({ locations: next })
    await data.writeModuleArray(campaignId, 'locations', next)
    if (target) void useActivity.getState().log(campaignId, 'Deleted location', target.name || '(unnamed)')
  },
}))
