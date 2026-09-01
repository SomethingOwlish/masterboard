import { describe, expect, it } from 'vitest'
import type { LibrarySourceData } from './library'
import { buildLibrary, filterLibrary } from './library'

const fakeData: LibrarySourceData = {
  characters: [
    { id: 'pc-b', name: 'Bryn', playerName: 'Owl', fields: [], tags: ['party'], links: [] },
    { id: 'pc-a', name: 'Aster', fields: [], tags: ['archived hero'], links: [], archived: true },
  ],
  npcs: [{ id: 'npc-f', name: 'The Fox', fields: [], tags: ['guild'], dead: false, links: [] }],
  locations: [{ id: 'loc-m', name: 'Moon Port', tags: ['guild'], links: [] }],
  misc: [{ id: 'misc-r', kind: 'rumor', name: 'Red Moon', fields: [], tags: ['moon'], links: [] }],
  connections: [
    { id: 'conn-lg', system: 'lovegame', scope: 'campaign', externalId: 'fake', label: 'Fake', state: 'active' },
  ],
  projections: [
    {
      id: 'projection-f', entityId: 'npc-f', connectionId: 'conn-lg', externalId: 'fake-npc',
      externalType: 'npc', visibility: 'masters-only', syncState: 'in-sync', mapping: [],
    },
  ],
}

describe('library index', () => {
  const records = buildLibrary(fakeData)

  it('starts in people and NPCs, hides archive, and sorts alphabetically', () => {
    expect(filterLibrary(records, {
      section: 'people', query: '', scope: 'selected-section',
    }).map((record) => record.name)).toEqual(['Bryn', 'The Fox'])
  })

  it('searches names and tags in the selected section', () => {
    expect(filterLibrary(records, {
      section: 'people', query: 'guild', scope: 'selected-section',
    }).map((record) => record.name)).toEqual(['The Fox'])
  })

  it('can expand one search to the entire library', () => {
    expect(filterLibrary(records, {
      section: 'people', query: 'moon', scope: 'all-library',
    }).map((record) => record.name)).toEqual(['Moon Port', 'Red Moon'])
  })

  it('filters by projection origin without losing Masterboard ownership', () => {
    expect(records.find((record) => record.id === 'npc-f')?.origins).toEqual(['masterboard', 'lovegame'])
    expect(filterLibrary(records, {
      section: 'people', query: '', scope: 'all-library', origin: 'lovegame',
    }).map((record) => record.name)).toEqual(['The Fox'])
  })
})
