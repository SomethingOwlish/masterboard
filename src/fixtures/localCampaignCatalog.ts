export type LocalCampaignEntityType = 'character' | 'npc' | 'creature' | 'location' | 'faction' | 'rumor' | 'item' | 'audience' | 'note' | 'letter' | 'handout' | 'map' | 'home-rule'

export interface LocalCampaignEntity {
  id: string
  type: LocalCampaignEntityType
  name: string
  description: string
  tags: string[]
}

export interface LocalCampaignRecord {
  id: string
  name: string
  idea: string
  activeTime: string
  masters: string
  sessions: number
  notes: string[]
  firstSessionTitle: string
  firstSessionObjective: string
  entities: LocalCampaignEntity[]
  updatedAt: string
}

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type CatalogLoadResult = { campaigns: LocalCampaignRecord[]; recovered: boolean }
const KEY = 'masterboard.local-campaigns.v1'

export const MOON_PORT: LocalCampaignRecord = {
  id: 'moon-port', name: 'Лунный порт', idea: 'Город в гавани заключает сделки с красной луной.',
  activeTime: 'Третья ночь Фестиваля фонарей', masters: 'Сова + Лис', sessions: 1,
  notes: [], firstSessionTitle: 'Первая ночь в Лунном порту', firstSessionObjective: 'Провести героев через первую ночь фестиваля.', entities: [], updatedAt: '2026-09-01T12:00:00.000Z',
}

const valid = (value: unknown): value is LocalCampaignRecord[] => Array.isArray(value) && value.every((item) => {
  if (!item || typeof item !== 'object') return false
  const record = item as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.name === 'string' && Array.isArray(record.notes)
})

export function createLocalCampaignCatalog(storage: KeyValueStorage, now = () => new Date().toISOString()) {
  const save = (campaigns: LocalCampaignRecord[]) => storage.setItem(KEY, JSON.stringify(campaigns))
  const load = (): CatalogLoadResult => {
    const raw = storage.getItem(KEY)
    if (!raw) return { campaigns: [structuredClone(MOON_PORT)], recovered: false }
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!valid(parsed)) throw new Error('invalid local campaign data')
      return { campaigns: structuredClone(parsed).map((campaign) => ({ ...campaign, firstSessionObjective: campaign.firstSessionObjective ?? '', entities: Array.isArray(campaign.entities) ? campaign.entities : [] })), recovered: false }
    } catch {
      storage.removeItem(KEY)
      return { campaigns: [structuredClone(MOON_PORT)], recovered: true }
    }
  }
  const update = (campaign: LocalCampaignRecord) => {
    const campaigns = load().campaigns
    const index = campaigns.findIndex((item) => item.id === campaign.id)
    const next = { ...campaign, updatedAt: now() }
    if (index < 0) campaigns.push(next); else campaigns[index] = next
    save(campaigns)
    return structuredClone(next)
  }
  return {
    load,
    create(name: string, idea: string) {
      const campaigns = load().campaigns
      const stamp = now()
      const campaign: LocalCampaignRecord = { id: `local-${stamp.replace(/\D/g, '')}`, name: name.trim(), idea: idea.trim() || 'Новая история ждёт первой сессии.', activeTime: 'Время ещё не задано', masters: 'Сова', sessions: 0, notes: [], firstSessionTitle: '', firstSessionObjective: '', entities: [], updatedAt: stamp }
      save([...campaigns, campaign])
      return structuredClone(campaign)
    },
    find(id: string) { return load().campaigns.find((item) => item.id === id) ?? null },
    update,
    clearLocal() { storage.removeItem(KEY) },
  }
}

const fallbackData = new Map<string, string>()
const fallbackStorage: KeyValueStorage = {
  getItem: (key) => fallbackData.get(key) ?? null,
  setItem: (key, value) => { fallbackData.set(key, value) },
  removeItem: (key) => { fallbackData.delete(key) },
}

export const localCampaignCatalog = createLocalCampaignCatalog(
  typeof window === 'undefined' ? fallbackStorage : window.localStorage,
)
