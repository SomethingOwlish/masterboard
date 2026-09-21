import { describe, expect, it } from 'vitest'
import { createLocalCampaignCatalog, type LocalCampaignEntity } from '../fixtures/localCampaignCatalog'
import { entitySceneReferences, validEntityDetails } from './localEntityDetails'
import { createLocalSession, deleteLocalSession } from './localSessions'

const npc: LocalCampaignEntity = { id: 'captain', type: 'npc', name: 'Captain', description: '', tags: [], dead: true, fields: [{ id: 'hp', label: 'Health', type: 'number', value: '12' }] }

describe('entity details in real campaigns', () => {
  it('preserves custom fields and character details through edit, reload and backup', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
    const catalog = createLocalCampaignCatalog(storage)
    const campaign = catalog.create('Test', '')
    const entities = [npc, { ...npc, id: 'pc', type: 'character' as const, playerName: 'Alice', fields: [{ id: 'bio', label: 'History', type: 'longtext' as const, value: 'First\nSecond' }] }]
    catalog.update({ ...campaign, entities })
    const loaded = createLocalCampaignCatalog(storage).find(campaign.id)!
    expect(loaded.entities).toEqual(entities)
    catalog.update({ ...loaded, entities: loaded.entities.map((entity) => ({ ...entity, name: 'Renamed' })) })
    catalog.importBackup(catalog.exportBackup())
    expect(catalog.load().campaigns[1].entities[1]).toMatchObject({ name: 'Renamed', playerName: 'Alice', fields: entities[1].fields })
  })
  it('accepts legacy entities but rejects malformed or duplicate fields', () => {
    expect(validEntityDetails({ ...npc, fields: undefined, dead: undefined })).toBe(true)
    expect(validEntityDetails(npc)).toBe(true)
    expect(validEntityDetails({ ...npc, fields: [...npc.fields!, ...npc.fields!] })).toBe(false)
    expect(validEntityDetails({ ...npc, fields: [{ ...npc.fields![0], value: 'NaN' }] })).toBe(false)
    expect(validEntityDetails({ ...npc, fields: [null] } as unknown as LocalCampaignEntity)).toBe(false)
  })
  it('finds references in future and deleted sessions, including unsaved current edits', () => {
    const catalog = createLocalCampaignCatalog({ getItem: () => null, setItem: () => {}, removeItem: () => {} })
    let campaign = createLocalSession(catalog.create('References', ''), 'First')
    const firstId = campaign.selectedSessionId!
    campaign = { ...campaign, firstSessionScenes: [{ id: 'gate', title: 'Gate', purpose: '', memberIds: [npc.id] }] }
    campaign = createLocalSession(campaign, 'Future')
    campaign = { ...campaign, firstSessionScenes: [{ id: 'port', title: 'Port', purpose: '', memberIds: [npc.id] }] }
    campaign = deleteLocalSession(campaign, firstId)
    expect(entitySceneReferences(campaign, npc.id)).toEqual([
      { sessionId: firstId, sessionTitle: 'First', sceneId: 'gate', sceneTitle: 'Gate', deleted: true },
      { sessionId: campaign.selectedSessionId, sessionTitle: 'Future', sceneId: 'port', sceneTitle: 'Port', deleted: false },
    ])
  })
})
