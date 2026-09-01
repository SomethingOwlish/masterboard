import type { ExternalConnection, ExternalProjection, ExternalSystem } from '../model/external'
import type { Character, Location, Misc, NPC } from '../model/types'

export type LibrarySection = 'people' | 'locations' | 'misc'
export type LibraryEntityKind = 'character' | 'npc' | 'location' | 'misc'
export type LibraryOrigin = 'masterboard' | ExternalSystem
export type LibrarySearchScope = 'selected-section' | 'all-library'

export interface LibraryRecord {
  id: string
  name: string
  section: LibrarySection
  kind: LibraryEntityKind
  kindLabel: string
  tags: string[]
  archived: boolean
  origins: LibraryOrigin[]
  route: string
  secondary?: string
}

export interface LibrarySourceData {
  characters: Character[]
  npcs: NPC[]
  locations: Location[]
  misc: Misc[]
  connections?: ExternalConnection[]
  projections?: ExternalProjection[]
}

export interface LibraryFilter {
  section: LibrarySection
  query: string
  scope: LibrarySearchScope
  origin?: LibraryOrigin
  includeArchived?: boolean
}

function originsFor(
  entityId: string,
  connections: Map<string, ExternalConnection>,
  projections: ExternalProjection[],
): LibraryOrigin[] {
  const origins = new Set<LibraryOrigin>(['masterboard'])
  for (const projection of projections) {
    if (projection.entityId !== entityId) continue
    const connection = connections.get(projection.connectionId)
    if (connection) origins.add(connection.system)
  }
  return [...origins]
}

export function buildLibrary(data: LibrarySourceData): LibraryRecord[] {
  const connections = new Map((data.connections ?? []).map((connection) => [connection.id, connection]))
  const projections = data.projections ?? []
  const common = (id: string, archived: boolean | undefined) => ({
    archived: archived ?? false,
    origins: originsFor(id, connections, projections),
  })

  return [
    ...data.characters.map((entity) => ({
      id: entity.id,
      name: entity.name,
      section: 'people' as const,
      kind: 'character' as const,
      kindLabel: 'Character',
      tags: entity.tags,
      route: `characters?focus=${encodeURIComponent(entity.id)}`,
      secondary: entity.playerName,
      ...common(entity.id, entity.archived),
    })),
    ...data.npcs.map((entity) => ({
      id: entity.id,
      name: entity.name,
      section: 'people' as const,
      kind: 'npc' as const,
      kindLabel: 'NPC',
      tags: entity.tags,
      route: `npcs?focus=${encodeURIComponent(entity.id)}`,
      secondary: entity.dead ? 'Dead' : undefined,
      ...common(entity.id, entity.archived),
    })),
    ...data.locations.map((entity) => ({
      id: entity.id,
      name: entity.name,
      section: 'locations' as const,
      kind: 'location' as const,
      kindLabel: 'Location',
      tags: entity.tags,
      route: `locations?focus=${encodeURIComponent(entity.id)}`,
      ...common(entity.id, entity.archived),
    })),
    ...data.misc.map((entity) => ({
      id: entity.id,
      name: entity.name,
      section: 'misc' as const,
      kind: 'misc' as const,
      kindLabel: entity.kind || 'Misc',
      tags: entity.tags,
      route: `misc?focus=${encodeURIComponent(entity.id)}`,
      ...common(entity.id, entity.archived),
    })),
  ]
}

export function filterLibrary(records: LibraryRecord[], filter: LibraryFilter): LibraryRecord[] {
  const query = filter.query.trim().toLocaleLowerCase()
  return records
    .filter((record) => filter.scope === 'all-library' || record.section === filter.section)
    .filter((record) => filter.includeArchived || !record.archived)
    .filter((record) => !filter.origin || record.origins.includes(filter.origin))
    .filter((record) => {
      if (!query) return true
      return record.name.toLocaleLowerCase().includes(query) || record.tags.some((tag) => tag.toLocaleLowerCase().includes(query))
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}
