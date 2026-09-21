import { createLocalSession, syncLocalSessions, validSessionDate, validSessionDocuments, type LocalSessionDocument } from '../lib/localSessions'
import { validSceneLayout, type ScenePoint } from '../lib/localSessionBoard'

export type LocalCampaignEntityType = 'character' | 'npc' | 'event' | 'creature' | 'location' | 'faction' | 'rumor' | 'item' | 'audience' | 'note' | 'letter' | 'handout' | 'map' | 'home-rule'

export interface LocalCampaignEntity {
  id: string
  type: LocalCampaignEntityType
  name: string
  description: string
  tags: string[]
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
  history: LocalClockChange[]
}

export interface LocalCampaignSecret {
  id: string
  title: string
  truth: string
  publicVersion: string
  recipients: string
  status: 'hidden' | 'partial' | 'selected' | 'everyone' | 'disproved' | 'obsolete'
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
  memberIds?: string[]
  position?: ScenePoint
  size?: { width: number; height: number }
  tokenPositions?: Record<string, ScenePoint>
  nextSceneIds?: string[]
}

export interface LocalSessionLogEntry {
  id: string
  text: string
  createdAt: string
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
  firstSessionDate?: string
  firstSessionRecap?: string
  firstSessionObjective: string
  firstSessionOpening: string
  firstSessionStatus: 'draft' | 'ready' | 'active' | 'completed'
  firstSessionScenes: LocalSessionScene[]
  firstSessionCurrentSceneId: string
  firstSessionLog: LocalSessionLogEntry[]
  entities: LocalCampaignEntity[]
  relations: LocalCampaignRelation[]
  storyArcs: LocalStoryArc[]
  clocks: LocalCampaignClock[]
  secrets: LocalCampaignSecret[]
  tasks: LocalCampaignTask[]
  inbox: LocalInboxItem[]
  updatedAt: string
  revision?: number
  sessionHistory?: LocalSessionArchive[]
  sessionDocuments?: LocalSessionDocument[]
  selectedSessionId?: string
  nextSessionSeq?: number
}

export interface LocalSessionArchive {
  id: string
  seq: number
  title: string
  objective: string
  opening: string
  scenes: LocalSessionScene[]
  log: LocalSessionLogEntry[]
  completedAt: string
  realDate?: string
  recap?: string
}

export function nextLocalSession(campaign: LocalCampaignRecord, title: string, now = new Date().toISOString()): LocalCampaignRecord {
  if (!title.trim()) throw new Error('Введите название сессии')
  if (campaign.firstSessionTitle && campaign.firstSessionStatus !== 'completed') throw new Error('Сначала завершите текущую сессию')
  return createLocalSession({ ...campaign, updatedAt: now }, title)
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
  notes: [], firstSessionTitle: 'Первая ночь в Лунном порту', firstSessionObjective: 'Провести героев через первую ночь фестиваля.', firstSessionOpening: 'Красный прилив доходит до лестниц с фонарями.', firstSessionStatus: 'draft', firstSessionScenes: [], firstSessionCurrentSceneId: '', firstSessionLog: [], entities: [], relations: [], storyArcs: [], clocks: [], secrets: [], tasks: [], inbox: [], updatedAt: '2026-09-01T12:00:00.000Z',
}

const ARRAY_FIELDS = ['notes', 'entities', 'relations', 'storyArcs', 'clocks', 'secrets', 'tasks', 'inbox', 'firstSessionScenes', 'firstSessionLog', 'sessionHistory'] as const

function normalize(value: unknown): LocalCampaignRecord[] {
  if (!Array.isArray(value)) throw new Error('Неверный формат каталога')
  const ids = new Set<string>()
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Повреждена запись кампании')
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' || !record.id || typeof record.name !== 'string' || !record.name.trim() || !Array.isArray(record.notes) || ids.has(record.id)) throw new Error('Неверное название или идентификатор кампании')
    ids.add(record.id)
    if (record.revision !== undefined && (!Number.isSafeInteger(record.revision) || Number(record.revision) < 0)) throw new Error('Повреждена версия кампании')
    for (const key of ARRAY_FIELDS) if (record[key] !== undefined && !Array.isArray(record[key])) throw new Error(`Повреждён раздел ${key}`)
    const campaign = { ...structuredClone(MOON_PORT), ...structuredClone(record), revision: record.revision ?? 0, sessionHistory: record.sessionHistory ?? [] } as LocalCampaignRecord
    for (const key of ARRAY_FIELDS) (campaign as unknown as Record<string, unknown>)[key] = record[key] ?? []
    for (const key of ['idea', 'activeTime', 'masters', 'firstSessionTitle', 'firstSessionObjective', 'firstSessionOpening', 'firstSessionCurrentSceneId', 'updatedAt'] as const) {
      if (record[key] !== undefined && typeof record[key] !== 'string') throw new Error(`Повреждено поле ${key}`)
      if (record[key] === undefined) campaign[key] = ''
    }
    if (!campaign.notes.every((note) => typeof note === 'string')) throw new Error('Повреждены заметки')
    // Reject malformed nested data before it can crash a screen or replace a good backup.
    const strings = (row: unknown, keys: string[]) => !!row && typeof row === 'object' && keys.every((key) => typeof (row as Record<string, unknown>)[key] === 'string')
    if (!campaign.entities.every((row) => strings(row, ['id', 'type', 'name', 'description']) && Array.isArray(row.tags) && row.tags.every((tag) => typeof tag === 'string')) ||
        !campaign.relations.every((row) => strings(row, ['id', 'fromId', 'toId', 'label', 'visibility'])) ||
        !campaign.firstSessionScenes.every((row) => strings(row, ['id', 'title', 'purpose']) && validSceneLayout(row) && (row.memberIds === undefined || Array.isArray(row.memberIds) && row.memberIds.every((id) => typeof id === 'string'))) ||
        !campaign.firstSessionLog.every((row) => strings(row, ['id', 'text', 'createdAt'])) ||
        !campaign.storyArcs.every((row) => strings(row, ['id', 'title', 'direction', 'stakes', 'status']) && Number.isFinite(row.progress)) ||
        !campaign.clocks.every((row) => strings(row, ['id', 'title', 'kind', 'visibility', 'trigger']) && Number.isFinite(row.value) && Number.isFinite(row.segments) && row.segments > 0 && Array.isArray(row.history) && row.history.every((entry) => strings(entry, ['id', 'reason', 'createdAt']) && Number.isFinite(entry.delta))) ||
        !campaign.secrets.every((row) => strings(row, ['id', 'title', 'truth', 'publicVersion', 'recipients', 'status'])) ||
        !campaign.tasks.every((row) => strings(row, ['id', 'text', 'source']) && typeof row.done === 'boolean') ||
        !campaign.inbox.every((row) => strings(row, ['id', 'text', 'createdAt']) && Array.isArray(row.tags) && row.tags.every((tag) => typeof tag === 'string')) ||
        !campaign.sessionHistory!.every((row) => strings(row, ['id', 'title', 'objective', 'opening', 'completedAt']) && Number.isInteger(row.seq) && Array.isArray(row.scenes) && row.scenes.every((scene) => strings(scene, ['id', 'title', 'purpose']) && validSceneLayout(scene) && (scene.memberIds === undefined || Array.isArray(scene.memberIds) && scene.memberIds.every((id) => typeof id === 'string'))) && Array.isArray(row.log) && row.log.every((entry) => strings(entry, ['id', 'text', 'createdAt'])))) throw new Error('Повреждены вложенные данные кампании')
    if (!['draft', 'ready', 'active', 'completed'].includes(campaign.firstSessionStatus)) campaign.firstSessionStatus = 'draft'
    if ((campaign.firstSessionDate !== undefined && (typeof campaign.firstSessionDate !== 'string' || !validSessionDate(campaign.firstSessionDate))) || (campaign.firstSessionRecap !== undefined && typeof campaign.firstSessionRecap !== 'string')) throw new Error('Повреждены параметры сессии')
    if (campaign.sessionDocuments !== undefined && !validSessionDocuments(campaign.sessionDocuments)) throw new Error('Повреждены документы сессий')
    if (campaign.selectedSessionId !== undefined && typeof campaign.selectedSessionId !== 'string') throw new Error('Повреждён идентификатор сессии')
    if (campaign.nextSessionSeq !== undefined && (!Number.isSafeInteger(campaign.nextSessionSeq) || campaign.nextSessionSeq < 1)) throw new Error('Повреждён счётчик сессий')
    const normalized = syncLocalSessions(campaign)
    if (!validSessionDocuments(normalized.sessionDocuments)) throw new Error('Повреждены данные сессий')
    return normalized
  })
}

export function createLocalCampaignCatalog(storage: KeyValueStorage, now = () => new Date().toISOString()) {
  const save = (campaigns: LocalCampaignRecord[]) => storage.setItem(KEY, JSON.stringify(normalize(campaigns)))
  const load = (): CatalogLoadResult => {
    const raw = storage.getItem(KEY)
    if (!raw) return { campaigns: [], recovered: false }
    try { return { campaigns: normalize(JSON.parse(raw)), recovered: false } }
    catch { return { campaigns: [], recovered: true } } // Never erase the only copy.
  }
  const writable = () => {
    const result = load()
    if (result.recovered) throw new Error('Каталог повреждён. Скачайте исходные данные перед восстановлением; запись заблокирована.')
    return result.campaigns
  }
  const update = (campaign: LocalCampaignRecord) => {
    const campaigns = writable()
    const index = campaigns.findIndex((item) => item.id === campaign.id)
    if (index < 0) throw new Error('Кампания больше не существует')
    if ((campaign.revision ?? 0) !== (campaigns[index].revision ?? 0)) throw new Error('Кампания изменена в другой вкладке. Перезагрузите страницу перед сохранением.')
    const next = normalize([{ ...campaign, revision: (campaign.revision ?? 0) + 1, updatedAt: now() }])[0]
    campaigns[index] = next
    save(campaigns)
    return structuredClone(next)
  }
  return {
    load,
    create(name: string, idea: string) {
      if (!name.trim()) throw new Error('Введите название кампании')
      const campaigns = writable()
      const campaign: LocalCampaignRecord = { ...structuredClone(MOON_PORT), id: `local-${crypto.randomUUID()}`, name: name.trim(), idea: idea.trim(), activeTime: '', masters: 'Ведущий', sessions: 0, firstSessionTitle: '', firstSessionObjective: '', firstSessionOpening: '', revision: 0, sessionHistory: [], updatedAt: now() }
      save([...campaigns, campaign])
      return structuredClone(campaign)
    },
    find(id: string) { return load().campaigns.find((item) => item.id === id) ?? null },
    update,
    exportBackup() { return JSON.stringify({ format: 'masterboard-backup/v1', exportedAt: now(), campaigns: writable() }, null, 2) },
    exportRaw() { return storage.getItem(KEY) ?? '[]' },
    importBackup(raw: string) {
      const parsed = JSON.parse(raw) as { format?: string; campaigns?: unknown }
      if (parsed?.format !== 'masterboard-backup/v1') throw new Error('Выберите резервную копию Masterboard v1')
      const incoming = normalize(parsed.campaigns)
      const current = load()
      if (current.recovered) storage.setItem(`${KEY}.recovery.${crypto.randomUUID()}`, storage.getItem(KEY)!)
      const campaigns = current.campaigns
      // Restore as independent copies; importing never overwrites existing work.
      const restored = incoming.map((campaign) => ({ ...campaign, id: `local-${crypto.randomUUID()}`, revision: 0, updatedAt: now() }))
      save([...campaigns, ...restored])
      return restored.length
    },
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
