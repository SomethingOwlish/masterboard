export type LocalCampaignEntityType = 'character' | 'npc' | 'creature' | 'location' | 'faction' | 'rumor' | 'item' | 'audience' | 'note' | 'letter' | 'handout' | 'map' | 'home-rule'

export interface LocalCampaignEntity {
  id: string
  type: LocalCampaignEntityType
  name: string
  description: string
  tags: string[]
  visibility?: 'master' | 'public'
  status?: 'active' | 'inactive' | 'archived'
}

export interface LocalCampaignRelation {
  id: string
  fromId: string
  toId: string
  label: string
  visibility: 'master' | 'public'
}

export interface LocalStoryArc {
  id: string
  title: string
  direction: string
  stakes: string
  status: 'planned' | 'active' | 'resolved'
  progress: number
  owner?: string
  mode?: 'background' | 'foreground'
}

export interface LocalClockChange { id: string; delta: number; reason: string; createdAt: string }
export interface LocalCampaignClock {
  id: string
  title: string
  kind: 'threat' | 'goal' | 'project' | 'world'
  value: number
  segments: number
  visibility: 'master' | 'public'
  trigger: string
  advanceCondition?: string
  rollbackCondition?: string
  history: LocalClockChange[]
}

export interface LocalCampaignSecret {
  id: string
  title: string
  truth: string
  publicVersion: string
  recipients: string
  status: 'hidden' | 'partial' | 'selected' | 'everyone' | 'disproved' | 'obsolete'
  revealCondition?: string
}

export interface LocalCampaignTask {
  id: string
  text: string
  source: 'masterboard' | 'preparation' | 'inbox'
  done: boolean
}

export interface LocalInboxItem { id: string; text: string; tags: string[]; createdAt: string }

export interface LocalSessionScene {
  id: string
  title: string
  purpose: string
  kind?: 'scene' | 'event' | 'question' | 'secret' | 'npc' | 'material'
  priority?: 'required' | 'desired' | 'useful' | 'backup'
  status?: 'prepared' | 'current' | 'used' | 'skipped' | 'moved' | 'cancelled'
}

export interface LocalSessionLogEntry {
  id: string
  text: string
  createdAt: string
}

export interface LocalSessionItem {
  id: string
  entityId: string
  role: string
  priority: 'required' | 'desired' | 'useful' | 'backup'
  status: 'prepared' | 'current' | 'used' | 'skipped' | 'moved' | 'cancelled'
  alternative: string
  note: string
}

export interface LocalSessionFlow {
  id: string
  fromItemId: string
  toItemId: string
  condition: string
}

export type LocalReviewDecision = 'carry' | 'library' | 'cancel' | 'keep'

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
  firstSessionOpening: string
  firstSessionMaster: string
  firstSessionArcId: string
  firstSessionInGameTime: string
  firstSessionIdea: string
  firstSessionStatus: 'draft' | 'ready' | 'active' | 'completed'
  firstSessionScenes: LocalSessionScene[]
  firstSessionCurrentSceneId: string
  firstSessionLog: LocalSessionLogEntry[]
  firstSessionItems?: LocalSessionItem[]
  firstSessionFlows?: LocalSessionFlow[]
  firstSessionReviewNotes?: string
  firstSessionReviewStatus?: 'draft' | 'completed'
  firstSessionReviewDecisions?: Record<string, LocalReviewDecision>
  entities: LocalCampaignEntity[]
  relations: LocalCampaignRelation[]
  storyArcs: LocalStoryArc[]
  clocks: LocalCampaignClock[]
  secrets: LocalCampaignSecret[]
  tasks: LocalCampaignTask[]
  inbox: LocalInboxItem[]
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
  notes: [], firstSessionTitle: 'Первая ночь в Лунном порту', firstSessionObjective: 'Провести героев через первую ночь фестиваля.', firstSessionOpening: 'Красный прилив доходит до лестниц с фонарями.', firstSessionMaster: 'Сова', firstSessionArcId: '', firstSessionInGameTime: 'Третья ночь фестиваля', firstSessionIdea: 'Герои впервые сталкиваются с ценой договора порта.', firstSessionStatus: 'draft', firstSessionScenes: [], firstSessionCurrentSceneId: '', firstSessionLog: [], entities: [], relations: [], storyArcs: [], clocks: [], secrets: [], tasks: [], inbox: [], updatedAt: '2026-09-01T12:00:00.000Z',
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
      return { campaigns: structuredClone(parsed).map((campaign) => ({ ...campaign, firstSessionObjective: campaign.firstSessionObjective ?? '', firstSessionOpening: campaign.firstSessionOpening ?? '', firstSessionMaster: campaign.firstSessionMaster ?? campaign.masters ?? '', firstSessionArcId: campaign.firstSessionArcId ?? '', firstSessionInGameTime: campaign.firstSessionInGameTime ?? '', firstSessionIdea: campaign.firstSessionIdea ?? '', firstSessionStatus: ['ready', 'active', 'completed'].includes(campaign.firstSessionStatus) ? campaign.firstSessionStatus : 'draft', firstSessionScenes: Array.isArray(campaign.firstSessionScenes) ? campaign.firstSessionScenes.map((scene) => ({ ...scene, kind: scene.kind ?? 'scene', priority: scene.priority ?? 'desired', status: scene.status ?? 'prepared' })) : [], firstSessionCurrentSceneId: campaign.firstSessionCurrentSceneId ?? '', firstSessionLog: Array.isArray(campaign.firstSessionLog) ? campaign.firstSessionLog : [], entities: Array.isArray(campaign.entities) ? campaign.entities.map((entity) => ({ ...entity, visibility: entity.visibility ?? 'master', status: entity.status ?? 'active' })) : [], relations: Array.isArray(campaign.relations) ? campaign.relations : [], storyArcs: Array.isArray(campaign.storyArcs) ? campaign.storyArcs.map((arc) => ({ ...arc, owner: arc.owner ?? '', mode: arc.mode ?? 'foreground' })) : [], clocks: Array.isArray(campaign.clocks) ? campaign.clocks.map((clock) => ({ ...clock, advanceCondition: clock.advanceCondition ?? '', rollbackCondition: clock.rollbackCondition ?? '' })) : [], secrets: Array.isArray(campaign.secrets) ? campaign.secrets.map((secret) => ({ ...secret, revealCondition: secret.revealCondition ?? '' })) : [], tasks: Array.isArray(campaign.tasks) ? campaign.tasks : [], inbox: Array.isArray(campaign.inbox) ? campaign.inbox : [] } as LocalCampaignRecord)), recovered: false }
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
      const campaign: LocalCampaignRecord = { id: `local-${stamp.replace(/\D/g, '')}`, name: name.trim(), idea: idea.trim() || 'Новая история ждёт первой сессии.', activeTime: 'Время ещё не задано', masters: 'Сова', sessions: 0, notes: [], firstSessionTitle: '', firstSessionObjective: '', firstSessionOpening: '', firstSessionMaster: 'Сова', firstSessionArcId: '', firstSessionInGameTime: '', firstSessionIdea: '', firstSessionStatus: 'draft', firstSessionScenes: [], firstSessionCurrentSceneId: '', firstSessionLog: [], entities: [], relations: [], storyArcs: [], clocks: [], secrets: [], tasks: [], inbox: [], updatedAt: stamp }
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
