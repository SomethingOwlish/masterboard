import { describe, expect, it } from 'vitest'
import { createLocalCampaignCatalog, nextLocalSession, type KeyValueStorage } from './localCampaignCatalog'

const memory = (): KeyValueStorage => { const data = new Map<string, string>(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: (key) => { data.delete(key) } } }

describe('local campaign catalog', () => {
  it('persists a created campaign between catalog instances', () => {
    const storage = memory()
    createLocalCampaignCatalog(storage, () => '2026-09-02T08:00:00.000Z').create(' Город под стеклом ', '')
    const loaded = createLocalCampaignCatalog(storage).load()
    expect(loaded.campaigns.at(-1)).toMatchObject({ name: 'Город под стеклом', sessions: 0, notes: [] })
    expect(loaded.campaigns.at(-1)?.firstSessionObjective).toBe('')
    expect(loaded.campaigns.at(-1)?.entities).toEqual([])
    expect(loaded.campaigns.at(-1)?.relations).toEqual([])
    expect(loaded.campaigns.at(-1)?.storyArcs).toEqual([])
    expect(loaded.campaigns.at(-1)).toMatchObject({ clocks: [], secrets: [], tasks: [], inbox: [] })
    expect(loaded.campaigns.at(-1)).toMatchObject({ firstSessionOpening: '', firstSessionStatus: 'draft', firstSessionScenes: [], firstSessionCurrentSceneId: '', firstSessionLog: [] })
  })
  it('migrates campaigns saved before session objectives existed', () => {
    const storage = memory()
    storage.setItem('masterboard.local-campaigns.v1', JSON.stringify([{ id: 'old', name: 'Старая', notes: [], firstSessionTitle: 'Старт' }]))
    expect(createLocalCampaignCatalog(storage).find('old')?.firstSessionObjective).toBe('')
    expect(createLocalCampaignCatalog(storage).find('old')?.entities).toEqual([])
    expect(createLocalCampaignCatalog(storage).find('old')?.relations).toEqual([])
    expect(createLocalCampaignCatalog(storage).find('old')?.storyArcs).toEqual([])
    expect(createLocalCampaignCatalog(storage).find('old')).toMatchObject({ clocks: [], secrets: [], tasks: [], inbox: [] })
    expect(createLocalCampaignCatalog(storage).find('old')).toMatchObject({ firstSessionOpening: '', firstSessionStatus: 'draft', firstSessionScenes: [], firstSessionCurrentSceneId: '', firstSessionLog: [] })
  })
  it('updates campaign preparation', () => {
    const storage = memory(); const catalog = createLocalCampaignCatalog(storage)
    const campaign = catalog.create('Тест', 'Идея')
    catalog.update({ ...campaign, notes: ['Назвать капитана'], firstSessionTitle: 'Встреча' })
    expect(catalog.find(campaign.id)).toMatchObject({ notes: ['Назвать капитана'], firstSessionTitle: 'Встреча' })
  })
  it('persists entities and their relations', () => {
    const storage = memory(); const catalog = createLocalCampaignCatalog(storage)
    const campaign = catalog.create('Карта', 'Связи')
    const entities = [
      { id: 'hero', type: 'character' as const, name: 'Ира', description: '', tags: [] },
      { id: 'city', type: 'location' as const, name: 'Город', description: '', tags: [] },
    ]
    catalog.update({ ...campaign, entities, relations: [{ id: 'route', fromId: 'hero', toId: 'city', label: 'ищет путь', visibility: 'master' }] })
    expect(catalog.find(campaign.id)).toMatchObject({ entities, relations: [{ label: 'ищет путь', visibility: 'master' }] })
  })
  it('persists story arcs and their progress', () => {
    const storage = memory(); const catalog = createLocalCampaignCatalog(storage)
    const campaign = catalog.create('Арки', 'Сюжет')
    const storyArcs = [{ id: 'arc-moon', title: 'Красная луна', direction: 'Луна требует новую сделку', stakes: 'Порт уйдёт под воду', status: 'active' as const, progress: 60 }]
    catalog.update({ ...campaign, storyArcs })
    expect(catalog.find(campaign.id)?.storyArcs).toEqual(storyArcs)
  })
  it('persists the local beta control-center data', () => {
    const storage = memory(); const catalog = createLocalCampaignCatalog(storage)
    const campaign = catalog.create('Пульт', 'Оперативные данные')
    catalog.update({ ...campaign,
      clocks: [{ id: 'clock-1', title: 'Прилив', kind: 'threat', value: 2, segments: 6, visibility: 'master', trigger: 'Порт затоплен', history: [{ id: 'change-1', delta: 1, reason: 'Луна взошла', createdAt: '2026-09-12T10:00:00.000Z' }] }],
      secrets: [{ id: 'secret-1', title: 'Цена договора', truth: 'Луна забирает имена', publicVersion: 'Договор требует жертвы', recipients: 'Ира', status: 'partial' }],
      tasks: [{ id: 'task-1', text: 'Подготовить карту', source: 'masterboard', done: false }],
      inbox: [{ id: 'inbox-1', text: 'Имя капитана', tags: ['npc'], createdAt: '2026-09-12T10:00:00.000Z' }],
    })
    expect(catalog.find(campaign.id)).toMatchObject({ clocks: [{ value: 2 }], secrets: [{ status: 'partial' }], tasks: [{ done: false }], inbox: [{ tags: ['npc'] }] })
  })
  it('persists a complete live-session lifecycle', () => {
    const storage = memory(); const catalog = createLocalCampaignCatalog(storage)
    const campaign = catalog.create('Игра', 'Полный цикл')
    const scene = { id: 'scene-gate', title: 'У ворот', purpose: 'Найти проводника' }
    catalog.update({ ...campaign, firstSessionTitle: 'Ночь', firstSessionStatus: 'active', firstSessionScenes: [scene], firstSessionCurrentSceneId: scene.id, firstSessionLog: [{ id: 'log-1', text: 'Ворота открылись', createdAt: '2026-09-02T20:00:00.000Z' }] })
    expect(catalog.find(campaign.id)).toMatchObject({ firstSessionStatus: 'active', firstSessionCurrentSceneId: scene.id, firstSessionLog: [{ text: 'Ворота открылись' }] })
    catalog.update({ ...catalog.find(campaign.id)!, firstSessionStatus: 'completed' })
    expect(catalog.find(campaign.id)?.firstSessionStatus).toBe('completed')
  })
  it('recovers safely from corrupt browser data', () => {
    const storage = memory(); storage.setItem('masterboard.local-campaigns.v1', '{broken')
    const result = createLocalCampaignCatalog(storage).load()
    expect(result.recovered).toBe(true)
    expect(result.campaigns).toEqual([])
    expect(storage.getItem('masterboard.local-campaigns.v1')).toBe('{broken')
    expect(() => createLocalCampaignCatalog(storage).create('Новая', '')).toThrow()
  })
})

describe('real campaign release regressions', () => {
  it('starts without demo campaigns and generates unique ids in the same millisecond', () => {
    const catalog = createLocalCampaignCatalog(memory(), () => '2026-09-20T00:00:00Z')
    expect(catalog.load().campaigns).toEqual([])
    expect(catalog.create('One', '').id).not.toBe(catalog.create('Two', '').id)
    expect(() => catalog.create('  ', '')).toThrow()
  })
  it('rejects stale writes from another tab without losing the newer work', () => {
    const storage = memory()
    const first = createLocalCampaignCatalog(storage)
    const second = createLocalCampaignCatalog(storage)
    const campaign = first.create('One', '')
    const stale = second.find(campaign.id)!
    first.update({ ...campaign, notes: ['new work'] })
    expect(() => second.update({ ...stale, notes: ['stale work'] })).toThrow('другой вкладке')
    expect(first.find(campaign.id)?.notes).toEqual(['new work'])
  })
  it('round trips a backup without overwriting existing campaigns', () => {
    const catalog = createLocalCampaignCatalog(memory())
    const campaign = catalog.create('One', '')
    catalog.update({ ...campaign, notes: ['Important'] })
    const backup = catalog.exportBackup()
    expect(catalog.importBackup(backup)).toBe(1)
    const copies = catalog.load().campaigns
    expect(copies).toHaveLength(2)
    expect(copies[0].id).not.toBe(copies[1].id)
    expect(copies[1].notes).toEqual(['Important'])
  })
  it('rejects malformed backups atomically', () => {
    const catalog = createLocalCampaignCatalog(memory())
    const campaign = catalog.create('One', '')
    const before = catalog.exportRaw()
    expect(() => catalog.importBackup(JSON.stringify({ format: 'masterboard-backup/v1', campaigns: [{ ...campaign, entities: [null] }] }))).toThrow()
    expect(catalog.exportRaw()).toBe(before)
  })
  it('preserves corrupt bytes when restoring from a valid backup', () => {
    const entries = new Map<string, string>()
    const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value) }, removeItem: (key: string) => { entries.delete(key) } }
    const catalog = createLocalCampaignCatalog(storage)
    catalog.create('Saved', '')
    const backup = catalog.exportBackup()
    storage.setItem('masterboard.local-campaigns.v1', 'broken')
    catalog.importBackup(backup)
    expect([...entries.entries()].some(([key, value]) => key.includes('.recovery.') && value === 'broken')).toBe(true)
    expect(catalog.load().campaigns[0].name).toBe('Saved')
  })
  it('surfaces storage quota failures without pretending a save succeeded', () => {
    const storage = memory()
    const catalog = createLocalCampaignCatalog(storage)
    const campaign = catalog.create('One', '')
    storage.setItem = () => { throw new Error('QuotaExceededError') }
    expect(() => catalog.update({ ...campaign, notes: ['unsaved'] })).toThrow('QuotaExceededError')
    expect(catalog.find(campaign.id)?.notes).toEqual([])
  })
  it('runs a second session while preserving the first plan and log after reload', () => {
    const storage = memory()
    const catalog = createLocalCampaignCatalog(storage)
    let campaign = catalog.create('Campaign', '')
    campaign = catalog.update(nextLocalSession(campaign, 'First'))
    expect(() => nextLocalSession(campaign, 'Premature')).toThrow()
    campaign = catalog.update({ ...campaign, firstSessionStatus: 'completed', firstSessionScenes: [{ id: 'scene', title: 'Gate', purpose: 'Enter' }], firstSessionLog: [{ id: 'log', text: 'Opened', createdAt: '2026-09-20' }] })
    campaign = catalog.update(nextLocalSession(campaign, 'Second'))
    const reloaded = createLocalCampaignCatalog(storage).find(campaign.id)!
    expect(reloaded.sessions).toBe(2)
    expect(reloaded.firstSessionTitle).toBe('Second')
    expect(reloaded.firstSessionLog).toEqual([])
    expect(reloaded.sessionHistory?.[0]).toMatchObject({ seq: 1, title: 'First', scenes: [{ title: 'Gate' }], log: [{ text: 'Opened' }] })
  })
})
