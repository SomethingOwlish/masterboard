import type { StorageGateway } from '../storage/gateway'
import { newId } from '../model/ids'
import { newMaster } from './team'
import { normalizeCampaign } from './normalize'
import { MOON_PORT } from './seed'
import type { LocalCampaignRecord } from './types'

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface QuarantinedRecord {
  id: string
  reason: string
  raw: string
  quarantinedAt: string
}

export interface CatalogLoadResult {
  campaigns: LocalCampaignRecord[]
  /** Damaged records moved aside instead of deleted; the user can download them. */
  quarantined: QuarantinedRecord[]
}

/**
 * An edit of a server campaign that has not reached the server yet. It is kept
 * in the browser so a lost connection or a reload does not lose it; `base` is
 * the server version the edit was made on, so it can be merged later.
 */
export interface CampaignDraft {
  campaign: LocalCampaignRecord
  baseRevision: number
  base: LocalCampaignRecord | null
  savedAt: string
}

export const EXPORT_FORMAT = 'masterboard-local-campaign/v1'
/** Key used before campaigns moved to IndexedDB. It is renamed, never deleted. */
export const LEGACY_KEY = 'masterboard.local-campaigns.v1'
export const LEGACY_BACKUP_KEY = 'masterboard.local-campaigns.v1.backup'

const CAMPAIGNS = 'localCampaigns'
const QUARANTINE = 'localQuarantine'
const DRAFTS = 'localDrafts'
const META = 'localMeta/catalog'

type Meta = { initialized: boolean; initializedAt: string }

export interface CatalogOptions {
  /** Pre-IndexedDB storage to migrate from once (normally `window.localStorage`). */
  legacyStorage?: KeyValueStorage
  now?: () => string
  /** Put the example campaign into an empty browser (default). Off when the browser only holds campaigns waiting to move to the server. */
  seed?: boolean
}

export type LocalCampaignCatalog = ReturnType<typeof createLocalCampaignCatalog>

export function blankCampaign(name: string, idea: string, stamp: string, ownerName = 'Мастер'): LocalCampaignRecord {
  return { id: newId('local'), name: name.trim(), idea: idea.trim(), activeTime: '', masters: [newMaster(ownerName, 'owner')], players: [], groups: [], archived: false, improv: [], dashboardLayouts: {}, publications: [], integrations: {}, notes: [], sessionRecords: [], entities: [], relations: [], storyArcs: [], clocks: [], secrets: [], tasks: [], inbox: [], relationLayout: {}, createdAt: stamp, updatedAt: stamp }
}

/** Reads a file made by «Экспорт»; throws a readable error for anything else. */
export function parseExport(json: string, stamp: string): LocalCampaignRecord {
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { throw new Error('Файл не является JSON') }
  const payload = parsed as { format?: unknown; campaign?: unknown }
  if (payload?.format !== EXPORT_FORMAT) throw new Error('Это не файл экспорта кампании Masterboard')
  const campaign = normalizeCampaign(payload.campaign, stamp)
  if (!campaign) throw new Error('В файле нет корректной кампании')
  return campaign
}

export function createLocalCampaignCatalog(gateway: StorageGateway, options: CatalogOptions = {}) {
  const now = options.now ?? (() => new Date().toISOString())
  const path = (id: string) => `${CAMPAIGNS}/${id}`

  const quarantine = async (raw: unknown, reason: string) => {
    const record: QuarantinedRecord = { id: newId('damaged'), reason, raw: typeof raw === 'string' ? raw : JSON.stringify(raw), quarantinedAt: now() }
    await gateway.set(`${QUARANTINE}/${record.id}`, { ...record })
  }

  /** First run: bring over campaigns from localStorage, or seed the example campaign. */
  let initializing: Promise<void> | null = null
  const initialize = () => {
    initializing ??= runInitialize().catch((error) => { initializing = null; throw error })
    return initializing
  }
  const runInitialize = async () => {
    if (await gateway.get<Meta>(META)) return
    const legacy = options.legacyStorage?.getItem(LEGACY_KEY)
    if (legacy) {
      let parsed: unknown
      try { parsed = JSON.parse(legacy) } catch { parsed = undefined }
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const campaign = normalizeCampaign(item, now())
          if (campaign) await gateway.set(path(campaign.id), { ...campaign })
          else await quarantine(item, 'Запись из localStorage не похожа на кампанию')
        }
      } else {
        await quarantine(legacy, 'Данные localStorage повреждены')
      }
      options.legacyStorage?.setItem(LEGACY_BACKUP_KEY, legacy)
      options.legacyStorage?.removeItem(LEGACY_KEY)
    } else if (options.seed !== false) {
      await gateway.set(path(MOON_PORT.id), { ...structuredClone(MOON_PORT) })
    }
    await gateway.set<Meta>(META, { initialized: true, initializedAt: now() })
  }

  const readAll = async (): Promise<LocalCampaignRecord[]> => {
    const campaigns: LocalCampaignRecord[] = []
    for (const snapshot of await gateway.list(CAMPAIGNS)) {
      const campaign = normalizeCampaign(snapshot.data, now())
      if (campaign) { campaigns.push(campaign); continue }
      await quarantine(snapshot.data, 'Сохранённая кампания повреждена')
      await gateway.remove(snapshot.path)
    }
    return campaigns.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  }

  const catalog = {
    async load(): Promise<CatalogLoadResult> {
      await initialize()
      const campaigns = await readAll()
      const quarantined = (await gateway.list<QuarantinedRecord & Record<string, unknown>>(QUARANTINE)).map((item) => item.data)
      return { campaigns, quarantined }
    },
    async find(id: string): Promise<LocalCampaignRecord | null> {
      await initialize()
      const snapshot = await gateway.get(path(id))
      return snapshot ? normalizeCampaign(snapshot.data, now()) : null
    },
    /** `integrations` — the base chosen at creation (ТЗ-2, R1). */
    async create(name: string, idea: string, integrations: LocalCampaignRecord['integrations'] = {}): Promise<LocalCampaignRecord> {
      await initialize()
      const campaign = { ...blankCampaign(name, idea, now()), integrations }
      await gateway.set(path(campaign.id), { ...campaign })
      return structuredClone(campaign)
    },
    async update(campaign: LocalCampaignRecord): Promise<LocalCampaignRecord> {
      const next = { ...campaign, updatedAt: now() }
      await gateway.set(path(next.id), { ...next })
      return structuredClone(next)
    },
    async remove(id: string): Promise<void> {
      await gateway.remove(path(id))
    },
    async exportCampaign(id: string): Promise<string> {
      const campaign = await catalog.find(id)
      if (!campaign) throw new Error('Кампания не найдена')
      return JSON.stringify({ format: EXPORT_FORMAT, exportedAt: now(), campaign }, null, 2)
    },
    /** Imports an exported file. A campaign with an existing id is imported as a copy. */
    async importCampaign(json: string): Promise<LocalCampaignRecord> {
      const campaign = parseExport(json, now())
      await initialize()
      const copy = (await gateway.get(path(campaign.id))) ? { ...campaign, id: newId('local'), name: `${campaign.name} (копия)` } : campaign
      await gateway.set(path(copy.id), { ...copy, updatedAt: now() })
      return structuredClone(copy)
    },
    async clearQuarantine(): Promise<void> {
      for (const item of await gateway.list(QUARANTINE)) await gateway.remove(item.path)
    },
    /** Unsynced edits of server campaigns (see `CampaignDraft`). */
    drafts: {
      async get(id: string): Promise<CampaignDraft | null> {
        const snapshot = await gateway.get<CampaignDraft & Record<string, unknown>>(`${DRAFTS}/${id}`)
        if (!snapshot) return null
        const campaign = normalizeCampaign(snapshot.data.campaign, now())
        return campaign ? { ...snapshot.data, campaign } : null
      },
      async set(draft: CampaignDraft): Promise<void> {
        await gateway.set(`${DRAFTS}/${draft.campaign.id}`, { ...draft } as CampaignDraft & Record<string, unknown>)
      },
      async remove(id: string): Promise<void> {
        await gateway.remove(`${DRAFTS}/${id}`)
      },
      async ids(): Promise<string[]> {
        return (await gateway.list(DRAFTS)).map((item) => item.path.slice(DRAFTS.length + 1))
      },
    },
  }
  return catalog
}
