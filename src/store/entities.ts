// Shared cross-module entity registry (B6). The Relation graph now spans every
// entity kind — PCs, NPCs, Locations, Misc — so the connections editor, the
// Relation board, and the Session planner all need one combined, kind-tagged view
// of the campaign's entities. This hook loads the four stores and returns that
// list; it's the single place new linkable kinds get wired in.

import { useEffect, useMemo } from 'react'
import { useCampaign } from './campaign'
import { useLocations } from './locations'
import { useMisc } from './misc'
import { useNpcs } from './npcs'
import { useRelations } from './relations'

export type EntityKind = 'pc' | 'npc' | 'location' | 'misc'

export interface EntityRef {
  id: string
  name: string
  kind: EntityKind
}

/** Glyph + module route per kind, shared by every consumer so they never drift. */
export const KIND_GLYPH: Record<EntityKind, string> = { pc: '🛡️', npc: '🎭', location: '📍', misc: '🎲' }
export const KIND_MODULE: Record<EntityKind, string> = { pc: 'characters', npc: 'npcs', location: 'locations', misc: 'misc' }

/**
 * Load every linkable entity for a campaign and return the combined, kind-tagged
 * list. Characters arrive with the open campaign; NPCs / Locations / Misc and the
 * relations graph are loaded here on demand. Pass the campaignId to trigger loads.
 */
export function useEntityPool(campaignId?: string): EntityRef[] {
  const characters = useCampaign((s) => s.characters)
  const npcs = useNpcs((s) => s.npcs)
  const locations = useLocations((s) => s.locations)
  const misc = useMisc((s) => s.misc)

  const loadNpcs = useNpcs((s) => s.load)
  const loadLocations = useLocations((s) => s.load)
  const loadMisc = useMisc((s) => s.load)
  const loadRelations = useRelations((s) => s.load)

  useEffect(() => {
    if (!campaignId) return
    void loadNpcs(campaignId)
    void loadLocations(campaignId)
    void loadMisc(campaignId)
    void loadRelations(campaignId)
  }, [campaignId, loadNpcs, loadLocations, loadMisc, loadRelations])

  return useMemo<EntityRef[]>(
    () => [
      ...characters.map((c) => ({ id: c.id, name: c.name || '(unnamed)', kind: 'pc' as const })),
      ...npcs.map((n) => ({ id: n.id, name: n.name || '(unnamed)', kind: 'npc' as const })),
      ...locations.map((l) => ({ id: l.id, name: l.name || '(unnamed)', kind: 'location' as const })),
      ...misc.map((m) => ({ id: m.id, name: m.name || '(unnamed)', kind: 'misc' as const })),
    ],
    [characters, npcs, locations, misc],
  )
}
