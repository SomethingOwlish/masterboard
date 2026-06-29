// Relation graph store (B4). relations.json is the single source of truth for the
// social graph — edited from both the Relation board and the character/NPC detail
// drawers. It also persists each node's saved board position.

import { create } from 'zustand'
import { newId } from '../model/ids'
import type { NodePosition, Relation } from '../model/types'
import { data } from '../storage/data'
import { useActivity } from './activity'

interface RelationsState {
  campaignId: string | null
  relations: Relation[]
  positions: Record<string, NodePosition>
  loading: boolean

  load: (campaignId: string) => Promise<void>
  addRelation: (input: { fromId: string; toId: string; label?: string; directed?: boolean }) => Promise<void>
  updateRelation: (id: string, patch: Partial<Relation>) => Promise<void>
  removeRelation: (id: string) => Promise<void>
  setPositions: (positions: Record<string, NodePosition>) => Promise<void>
  /** Drop any relations / positions referencing an entity that no longer exists. */
  pruneMissing: (existingIds: Set<string>) => Promise<void>
}

export const useRelations = create<RelationsState>((set, get) => ({
  campaignId: null,
  relations: [],
  positions: {},
  loading: false,

  load: async (campaignId) => {
    if (get().campaignId === campaignId && !get().loading) return
    set({ loading: true, campaignId, relations: [], positions: {} })
    const doc = await data.readRelations(campaignId)
    if (get().campaignId === campaignId) set({ ...doc, loading: false })
  },

  addRelation: async ({ fromId, toId, label = '', directed = false }) => {
    const { campaignId, relations, positions } = get()
    if (!campaignId) return
    const relation: Relation = { id: newId('rel'), fromId, toId, label, directed }
    const next = [...relations, relation]
    set({ relations: next })
    await data.writeRelations(campaignId, { relations: next, positions })
    void useActivity.getState().log(campaignId, 'Added relation', label || undefined)
  },

  updateRelation: async (id, patch) => {
    const { campaignId, relations, positions } = get()
    if (!campaignId) return
    const next = relations.map((r) => (r.id === id ? { ...r, ...patch } : r))
    set({ relations: next })
    await data.writeRelations(campaignId, { relations: next, positions })
  },

  removeRelation: async (id) => {
    const { campaignId, relations, positions } = get()
    if (!campaignId) return
    const next = relations.filter((r) => r.id !== id)
    set({ relations: next })
    await data.writeRelations(campaignId, { relations: next, positions })
    void useActivity.getState().log(campaignId, 'Removed relation')
  },

  setPositions: async (positions) => {
    const { campaignId, relations } = get()
    if (!campaignId) return
    set({ positions })
    await data.writeRelations(campaignId, { relations, positions })
  },

  pruneMissing: async (existingIds) => {
    const { campaignId, relations, positions } = get()
    if (!campaignId) return
    const keptRelations = relations.filter((r) => existingIds.has(r.fromId) && existingIds.has(r.toId))
    const keptPositions: Record<string, NodePosition> = {}
    for (const [id, pos] of Object.entries(positions)) if (existingIds.has(id)) keptPositions[id] = pos
    if (keptRelations.length === relations.length && Object.keys(keptPositions).length === Object.keys(positions).length) return
    set({ relations: keptRelations, positions: keptPositions })
    await data.writeRelations(campaignId, { relations: keptRelations, positions: keptPositions })
  },
}))
