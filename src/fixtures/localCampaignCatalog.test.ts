import { describe, expect, it } from 'vitest'
import { createLocalCampaignCatalog, type KeyValueStorage } from './localCampaignCatalog'

const memory = (): KeyValueStorage => { const data = new Map<string, string>(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: (key) => { data.delete(key) } } }

describe('local campaign catalog', () => {
  it('persists a created campaign between catalog instances', () => {
    const storage = memory()
    createLocalCampaignCatalog(storage, () => '2026-09-02T08:00:00.000Z').create(' Город под стеклом ', '')
    const loaded = createLocalCampaignCatalog(storage).load()
    expect(loaded.campaigns.at(-1)).toMatchObject({ name: 'Город под стеклом', sessions: 0, notes: [] })
    expect(loaded.campaigns.at(-1)?.firstSessionObjective).toBe('')
    expect(loaded.campaigns.at(-1)?.entities).toEqual([])
  })
  it('migrates campaigns saved before session objectives existed', () => {
    const storage = memory()
    storage.setItem('masterboard.local-campaigns.v1', JSON.stringify([{ id: 'old', name: 'Старая', notes: [], firstSessionTitle: 'Старт' }]))
    expect(createLocalCampaignCatalog(storage).find('old')?.firstSessionObjective).toBe('')
    expect(createLocalCampaignCatalog(storage).find('old')?.entities).toEqual([])
  })
  it('updates campaign preparation', () => {
    const storage = memory(); const catalog = createLocalCampaignCatalog(storage)
    const campaign = catalog.create('Тест', 'Идея')
    catalog.update({ ...campaign, notes: ['Назвать капитана'], firstSessionTitle: 'Встреча' })
    expect(catalog.find(campaign.id)).toMatchObject({ notes: ['Назвать капитана'], firstSessionTitle: 'Встреча' })
  })
  it('recovers safely from corrupt browser data', () => {
    const storage = memory(); storage.setItem('masterboard.local-campaigns.v1', '{broken')
    const result = createLocalCampaignCatalog(storage).load()
    expect(result.recovered).toBe(true)
    expect(result.campaigns[0].id).toBe('moon-port')
  })
})
