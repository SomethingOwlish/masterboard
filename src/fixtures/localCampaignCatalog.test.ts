import { describe, expect, it } from 'vitest'
import { createLocalCampaignCatalog, getLocalSessions, withLocalSessions, type KeyValueStorage } from './localCampaignCatalog'

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
    const storyArcs = [{ id: 'arc-moon', title: 'Красная луна', direction: 'Луна требует новую сделку', stakes: 'Порт уйдёт под воду', status: 'active' as const, progress: 60, owner: '', mode: 'foreground' as const }]
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
  it('migrates the legacy first session into the multi-session model', () => {
    const catalog = createLocalCampaignCatalog(memory())
    const campaign = catalog.create('Миграция', 'Без потери данных')
    const legacy = { ...campaign, firstSessionTitle: 'Старая первая', firstSessionObjective: 'Сохранить цель', firstSessionScenes: [{ id: 'scene-1', title: 'Ворота', purpose: 'Войти' }] }
    const sessions = getLocalSessions(legacy)
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({ number: 1, title: 'Старая первая', focus: 'Сохранить цель' })
    expect(sessions[0].planItems[0]).toMatchObject({ source: 'text', kind: 'scene', text: 'Ворота', note: 'Войти' })
  })
  it('persists several sessions with linked and free-text plan items', () => {
    const catalog = createLocalCampaignCatalog(memory())
    const campaign = catalog.create('Несколько игр', 'Планируем заранее')
    const base = getLocalSessions({ ...campaign, firstSessionTitle: 'Первая' })[0]
    const second = { ...base, id: 'session-2', number: 2, title: 'Вторая', planItems: [{ id: 'free-1', source: 'text' as const, text: 'Неожиданный свидетель', kind: 'idea' as const, priority: 'useful' as const, status: 'prepared' as const, role: '', alternative: '', note: '', origin: 'prepared' as const }] }
    catalog.update(withLocalSessions(campaign, [base, second], second.id))
    const loaded = catalog.find(campaign.id)!
    expect(loaded.sessions).toBe(2)
    expect(loaded.activeSessionId).toBe('session-2')
    expect(getLocalSessions(loaded)[1].planItems[0]).toMatchObject({ source: 'text', text: 'Неожиданный свидетель' })
  })
  it('recovers safely from corrupt browser data', () => {
    const storage = memory(); storage.setItem('masterboard.local-campaigns.v1', '{broken')
    const result = createLocalCampaignCatalog(storage).load()
    expect(result.recovered).toBe(true)
    expect(result.campaigns[0].id).toBe('moon-port')
  })
})
