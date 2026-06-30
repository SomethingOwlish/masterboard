// Print/Export compiler core (M12 / B9). Pure resolution logic kept out of the
// page: given a session document and the campaign's entity pools, it gathers the
// printable sheet — the party roster plus every scene with its members resolved to
// their full records (NPCs, locations, items, events). The Session planner derives
// `scenes` from the board's scene nodes on every save (see lib/board.deriveScenes),
// so Print reads structured data, not a canvas image.

import type { Character, ChronoEvent, Location, Misc, NPC, SessionDoc } from '../model/types'

export type MemberKind = 'pc' | 'npc' | 'location' | 'misc' | 'event' | 'unknown'

export interface ResolvedMember {
  kind: MemberKind
  id: string
  name: string
  character?: Character
  npc?: NPC
  location?: Location
  misc?: Misc
  event?: ChronoEvent
}

export interface PrintScene {
  id: string
  name: string
  members: ResolvedMember[]
}

export interface PrintDoc {
  party: Character[]
  scenes: PrintScene[]
  /** Members whose referenced entity no longer exists (deleted after placement). */
  missing: number
}

export interface PrintPools {
  characters: Character[]
  npcs: NPC[]
  locations: Location[]
  misc: Misc[]
  events: ChronoEvent[]
}

export function compilePrint(session: SessionDoc, pools: PrintPools): PrintDoc {
  const byId = {
    pc: new Map(pools.characters.map((c) => [c.id, c])),
    npc: new Map(pools.npcs.map((n) => [n.id, n])),
    location: new Map(pools.locations.map((l) => [l.id, l])),
    misc: new Map(pools.misc.map((m) => [m.id, m])),
    event: new Map(pools.events.map((e) => [e.id, e])),
  }

  let missing = 0
  const resolve = (toId: string, rawKind?: string): ResolvedMember => {
    switch (rawKind) {
      case 'pc': {
        const c = byId.pc.get(toId)
        if (c) return { kind: 'pc', id: toId, name: c.name || '(unnamed)', character: c }
        break
      }
      case 'npc': {
        const n = byId.npc.get(toId)
        if (n) return { kind: 'npc', id: toId, name: n.name || '(unnamed)', npc: n }
        break
      }
      case 'location': {
        const l = byId.location.get(toId)
        if (l) return { kind: 'location', id: toId, name: l.name || '(unnamed)', location: l }
        break
      }
      case 'misc': {
        const m = byId.misc.get(toId)
        if (m) return { kind: 'misc', id: toId, name: m.name || '(unnamed)', misc: m }
        break
      }
      case 'event': {
        const e = byId.event.get(toId)
        if (e) return { kind: 'event', id: toId, name: e.title || e.date || '(event)', event: e }
        break
      }
    }
    missing++
    return { kind: 'unknown', id: toId, name: '(removed)' }
  }

  const scenes: PrintScene[] = session.scenes.map((s) => ({
    id: s.id,
    name: s.name || 'Scene',
    members: s.members.map((m) => resolve(m.toId, m.kind)),
  }))

  return { party: pools.characters, scenes, missing }
}
