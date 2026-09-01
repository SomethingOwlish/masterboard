import { describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { CampaignPermissionError } from './campaignRepository'
import { EntityLibrary, type TargetEntityDocument } from './entityLibrary'

const CAMPAIGN = 'moon-port'
const NOW = '2026-09-01T18:00:00.000Z'

function setup() {
  const storage = new MemoryStorageGateway({
    [`campaigns/${CAMPAIGN}`]: {
      name: 'Moon Port', mode: 'single-group', ownerId: 'owl', coMasterId: 'fox', createdAt: NOW, updatedAt: NOW,
    },
    [`campaigns/${CAMPAIGN}/entities/npc-fox`]: {
      entityType: 'npc', name: 'The Silver Fox', status: 'active', tags: ['guild', 'secret'], archived: false,
      createdAt: NOW, updatedAt: NOW,
    },
    [`campaigns/${CAMPAIGN}/entities/location-gate`]: {
      entityType: 'location', name: 'Eastern Gate', status: 'exists', tags: ['harbor'], archived: false,
      createdAt: NOW, updatedAt: NOW,
    },
    [`campaigns/${CAMPAIGN}/entities/note-old`]: {
      entityType: 'note', name: 'Old note', status: 'inactive', tags: [], archived: true,
      createdAt: NOW, updatedAt: NOW,
    },
    [`campaigns/${CAMPAIGN}/connections/lovegame-main`]: {
      system: 'lovegame', label: 'Fake Lovegame', createdAt: NOW, updatedAt: NOW,
    },
    [`campaigns/${CAMPAIGN}/projections/fox-lovegame`]: {
      entityId: 'npc-fox', connectionId: 'lovegame-main', visibility: 'masters-only', syncState: 'synced',
      createdAt: NOW, updatedAt: NOW,
    },
    [`campaigns/${CAMPAIGN}/inbox/note-bell`]: {
      text: 'A bell rings below the harbor', state: 'unprocessed', targetType: 'note',
      createdAt: NOW, updatedAt: NOW,
    },
  })
  return { storage, library: new EntityLibrary(storage) }
}

describe('EntityLibrary', () => {
  it('lists only accessible active entities and resolves projection origins', async () => {
    const { library } = setup()
    const records = await library.list(CAMPAIGN, 'owl')
    expect(records.map((record) => record.entity.name)).toEqual(['Eastern Gate', 'The Silver Fox'])
    expect(records.find((record) => record.id === 'npc-fox')).toMatchObject({
      origins: ['masterboard', 'lovegame'], projectionCount: 1,
    })
    await expect(library.list(CAMPAIGN, 'outsider')).rejects.toBeInstanceOf(CampaignPermissionError)
  })

  it('searches names and tags and filters by type, origin, and archive state', async () => {
    const { library } = setup()
    expect((await library.list(CAMPAIGN, 'fox', { query: 'guild' })).map((item) => item.id)).toEqual(['npc-fox'])
    expect((await library.list(CAMPAIGN, 'fox', { types: ['location'] })).map((item) => item.id)).toEqual(['location-gate'])
    expect((await library.list(CAMPAIGN, 'fox', { origin: 'lovegame' })).map((item) => item.id)).toEqual(['npc-fox'])
    expect(await library.list(CAMPAIGN, 'fox', { origin: 'lorebook' })).toEqual([])
    expect(await library.list(CAMPAIGN, 'fox', { includeArchived: true })).toHaveLength(3)
  })

  it('creates normalized manual entities with Masterboard ownership', async () => {
    const { library } = setup()
    const created = await library.createManual(CAMPAIGN, 'owl', {
      id: 'faction-lanterns', entityType: 'faction', name: '  Lantern Guild ',
      tags: [' Guild ', 'guild', 'Harbor'], description: '  Keeps the eastern lights. ',
    }, NOW)
    expect(created.data).toMatchObject({
      name: 'Lantern Guild', entityType: 'faction', status: 'active',
      tags: ['guild', 'harbor'], description: 'Keeps the eastern lights.', archived: false,
    })
    expect((await library.list(CAMPAIGN, 'owl')).find((item) => item.id === 'faction-lanterns')?.origins).toEqual(['masterboard'])
  })

  it('atomically converts one inbox note into multiple typed entities', async () => {
    const { storage, library } = setup()
    const result = await library.convertInbox(CAMPAIGN, 'note-bell', 'fox', [
      { id: 'item-bell', entityType: 'item', name: 'Drowned Bell', tags: ['clue'] },
      { id: 'npc-keeper', entityType: 'npc', name: 'The Bell Keeper', description: 'Knows who rings it.' },
    ], NOW)
    expect(result.map((item) => item?.data.name)).toEqual(['Drowned Bell', 'The Bell Keeper'])
    expect(result[0]?.data).toMatchObject({ sourceNoteId: 'note-bell', description: 'A bell rings below the harbor' })
    expect(await storage.get(`campaigns/${CAMPAIGN}/inbox/note-bell`)).toMatchObject({
      data: { state: 'processed', resultingEntityIds: ['item-bell', 'npc-keeper'] },
    })
  })

  it('rolls the whole conversion back when any resulting entity is invalid or duplicated', async () => {
    const { storage, library } = setup()
    await expect(library.convertInbox(CAMPAIGN, 'note-bell', 'owl', [
      { id: 'new-item', entityType: 'item', name: 'New item' },
      { id: 'npc-fox', entityType: 'npc', name: 'Duplicate' },
    ], NOW)).rejects.toThrow('Entity npc-fox already exists')

    expect(await storage.get<TargetEntityDocument>(`campaigns/${CAMPAIGN}/entities/new-item`)).toBeNull()
    expect(await storage.get(`campaigns/${CAMPAIGN}/inbox/note-bell`)).toMatchObject({ data: { state: 'unprocessed' } })
  })
})

