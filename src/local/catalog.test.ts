import { describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { LEGACY_BACKUP_KEY, LEGACY_KEY, createLocalCampaignCatalog, type KeyValueStorage } from './catalog'
import { blankSession, isCampaignReady, withLocalSessions } from './normalize'

const memory = (seed: Record<string, string> = {}): KeyValueStorage & { data: Map<string, string> } => {
  const data = new Map(Object.entries(seed))
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: (key) => { data.delete(key) } }
}

describe('local campaign catalog', () => {
  it('seeds the example campaign only on first launch', async () => {
    const gateway = new MemoryStorageGateway()
    const catalog = createLocalCampaignCatalog(gateway)
    expect((await catalog.load()).campaigns.map((item) => item.id)).toEqual(['moon-port'])
    await catalog.remove('moon-port')
    expect((await createLocalCampaignCatalog(gateway).load()).campaigns).toEqual([])
  })

  it('persists a created campaign between catalog instances', async () => {
    const gateway = new MemoryStorageGateway()
    const created = await createLocalCampaignCatalog(gateway, { now: () => '2026-09-26T08:00:00.000Z' }).create(' Город под стеклом ', '')
    const loaded = await createLocalCampaignCatalog(gateway).find(created.id)
    expect(loaded).toMatchObject({ name: 'Город под стеклом', notes: [], sessionRecords: [], entities: [], clocks: [], secrets: [], tasks: [], inbox: [] })
    expect(isCampaignReady(loaded!)).toBe(false)
  })

  it('gives campaigns created in the same millisecond different ids', async () => {
    const catalog = createLocalCampaignCatalog(new MemoryStorageGateway(), { now: () => '2026-09-26T08:00:00.000Z' })
    const [first, second] = await Promise.all([catalog.create('A', ''), catalog.create('B', '')])
    expect(first.id).not.toBe(second.id)
  })

  it('persists several sessions and the active one', async () => {
    const catalog = createLocalCampaignCatalog(new MemoryStorageGateway())
    const campaign = await catalog.create('Несколько игр', 'Планируем заранее')
    const first = { ...blankSession(1, 'Сова', '2026-09-26T08:00:00.000Z'), title: 'Первая' }
    const second = { ...blankSession(2, 'Лис', '2026-09-26T08:00:00.000Z'), title: 'Вторая', planItems: [{ id: 'free-1', source: 'text' as const, text: 'Неожиданный свидетель', kind: 'idea' as const, priority: 'useful' as const, status: 'prepared' as const, role: '', alternative: '', note: '', origin: 'prepared' as const }] }
    await catalog.update(withLocalSessions(campaign, [first, second], second.id))
    const loaded = (await catalog.find(campaign.id))!
    expect(loaded.sessionRecords).toHaveLength(2)
    expect(loaded.activeSessionId).toBe(second.id)
    expect(loaded.sessionRecords[1].planItems[0]).toMatchObject({ text: 'Неожиданный свидетель' })
    expect(isCampaignReady(loaded)).toBe(true)
  })

  it('stays ready after the last world note is deleted', async () => {
    const catalog = createLocalCampaignCatalog(new MemoryStorageGateway())
    const campaign = await catalog.create('Заметки', '')
    const ready = withLocalSessions({ ...campaign, notes: ['Одна'] }, [{ ...blankSession(1, '', campaign.createdAt), title: 'Старт' }])
    await catalog.update({ ...ready, notes: [] })
    expect(isCampaignReady((await catalog.find(campaign.id))!)).toBe(true)
  })

  it('migrates localStorage campaigns once and keeps a backup', async () => {
    const legacy = [{ id: 'old', name: 'Старая', notes: ['Факт'], masters: 'Сова', sessions: 1, firstSessionTitle: 'Старт', firstSessionObjective: 'Цель', firstSessionStatus: 'ready', firstSessionScenes: [{ id: 'scene-1', title: 'Ворота', purpose: 'Войти' }], firstSessionLog: [{ id: 'log-1', text: 'Открыли', createdAt: '2026-09-01T00:00:00.000Z' }] }]
    const storage = memory({ [LEGACY_KEY]: JSON.stringify(legacy) })
    const gateway = new MemoryStorageGateway()
    const { campaigns, quarantined } = await createLocalCampaignCatalog(gateway, { legacyStorage: storage }).load()
    expect(quarantined).toEqual([])
    expect(campaigns.map((item) => item.id)).toEqual(['old'])
    const [session] = campaigns[0].sessionRecords
    expect(session).toMatchObject({ number: 1, title: 'Старт', focus: 'Цель', status: 'ready', log: [{ text: 'Открыли' }] })
    expect(session.planItems[0]).toMatchObject({ source: 'text', kind: 'scene', text: 'Ворота', note: 'Войти' })
    expect(campaigns[0]).not.toHaveProperty('firstSessionTitle')
    expect(storage.data.has(LEGACY_KEY)).toBe(false)
    expect(storage.data.get(LEGACY_BACKUP_KEY)).toBe(JSON.stringify(legacy))
    storage.setItem(LEGACY_KEY, JSON.stringify([{ id: 'again', name: 'Повтор', notes: [] }]))
    expect((await createLocalCampaignCatalog(gateway, { legacyStorage: storage }).load()).campaigns.map((item) => item.id)).toEqual(['old'])
  })

  it('migrates only once when first-launch loads overlap', async () => {
    const storage = memory({ [LEGACY_KEY]: '{broken' })
    const catalog = createLocalCampaignCatalog(new MemoryStorageGateway(), { legacyStorage: storage })
    const [first] = await Promise.all([catalog.load(), catalog.load()])
    expect(first.quarantined).toHaveLength(1)
  })

  it('quarantines corrupt data instead of deleting it', async () => {
    const storage = memory({ [LEGACY_KEY]: '{broken' })
    const gateway = new MemoryStorageGateway()
    const catalog = createLocalCampaignCatalog(gateway, { legacyStorage: storage })
    const first = await catalog.load()
    expect(first.quarantined).toHaveLength(1)
    expect(first.quarantined[0].raw).toBe('{broken')
    await gateway.set('localCampaigns/bad', { nonsense: true })
    const second = await catalog.load()
    expect(second.quarantined).toHaveLength(2)
    expect(await gateway.get('localCampaigns/bad')).toBeNull()
    await catalog.clearQuarantine()
    expect((await catalog.load()).quarantined).toEqual([])
  })

  it('exports and imports a campaign, copying on id collision', async () => {
    const catalog = createLocalCampaignCatalog(new MemoryStorageGateway())
    const campaign = await catalog.create('Экспорт', 'Проверка')
    await catalog.update({ ...campaign, notes: ['Факт'] })
    const file = await catalog.exportCampaign(campaign.id)
    const copy = await catalog.importCampaign(file)
    expect(copy.id).not.toBe(campaign.id)
    expect(copy).toMatchObject({ name: 'Экспорт (копия)', notes: ['Факт'] })

    const fresh = createLocalCampaignCatalog(new MemoryStorageGateway())
    expect((await fresh.importCampaign(file)).id).toBe(campaign.id)
    await expect(fresh.importCampaign('{"format":"other"}')).rejects.toThrow('Это не файл экспорта')
    await expect(fresh.importCampaign('nope')).rejects.toThrow('JSON')
  })
})
