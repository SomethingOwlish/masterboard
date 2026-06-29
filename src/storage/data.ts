// Typed data-access over the repository. Centralizes the GM-handle resolution and
// the path layout so stores never touch raw paths. When no GM handle is set
// (purely-local use before GitHub is configured) we file everything under
// `local`, so configuring sync later is a matter of pointing at a repo.

import type {
  ActivityEntry,
  Campaign,
  CampaignSummary,
  ModuleId,
  RelationsDoc,
  SessionRecap,
  TimelineDoc,
} from '../model/types'
import { useConfig } from '../store/config'
import { paths } from './paths'
import { repo } from './repository'

function gm(): string {
  return useConfig.getState().config.gmHandle || 'local'
}

export const data = {
  async listCampaigns(): Promise<CampaignSummary[]> {
    const list = (await repo.read(paths.campaignsIndex(gm()))) as CampaignSummary[] | null
    return Array.isArray(list) ? list : []
  },

  async saveCampaignsIndex(list: CampaignSummary[]): Promise<void> {
    await repo.write(paths.campaignsIndex(gm()), list)
  },

  async readCampaign(id: string): Promise<Campaign | null> {
    return (await repo.read(paths.module(gm(), id, 'campaign'))) as Campaign | null
  },

  async writeCampaign(c: Campaign): Promise<void> {
    await repo.write(paths.module(gm(), c.id, 'campaign'), c)
  },

  /** Patch a single entry in campaigns/index.json (name/cover/lastPlayed). */
  async patchSummary(id: string, patch: Partial<CampaignSummary>): Promise<void> {
    const list = await this.listCampaigns()
    const next = list.map((s) => (s.id === id ? { ...s, ...patch } : s))
    await this.saveCampaignsIndex(next)
  },

  async deleteCampaignFiles(id: string): Promise<void> {
    const g = gm()
    const mods: ModuleId[] = [
      'campaign', 'log', 'characters', 'npcs', 'locations', 'misc', 'relations', 'timeline', 'activity',
    ]
    await Promise.all(mods.map((m) => repo.remove(paths.module(g, id, m))))
  },

  async readRecaps(id: string): Promise<SessionRecap[]> {
    const list = (await repo.read(paths.module(gm(), id, 'log'))) as SessionRecap[] | null
    return Array.isArray(list) ? list : []
  },

  async writeRecaps(id: string, recaps: SessionRecap[]): Promise<void> {
    await repo.write(paths.module(gm(), id, 'log'), recaps)
  },

  async readActivity(id: string): Promise<ActivityEntry[]> {
    const list = (await repo.read(paths.module(gm(), id, 'activity'))) as ActivityEntry[] | null
    return Array.isArray(list) ? list : []
  },

  async writeActivity(id: string, entries: ActivityEntry[]): Promise<void> {
    await repo.write(paths.module(gm(), id, 'activity'), entries)
  },

  /** Generic JSON-array module reader used by simple list modules. */
  async readModuleArray<T>(id: string, mod: ModuleId): Promise<T[]> {
    const list = (await repo.read(paths.module(gm(), id, mod))) as T[] | null
    return Array.isArray(list) ? list : []
  },

  /** Generic JSON-array module writer (characters, npcs, …). */
  async writeModuleArray<T>(id: string, mod: ModuleId, items: T[]): Promise<void> {
    await repo.write(paths.module(gm(), id, mod), items)
  },

  async readRelations(id: string): Promise<RelationsDoc> {
    const doc = (await repo.read(paths.module(gm(), id, 'relations'))) as RelationsDoc | null
    return doc && Array.isArray(doc.relations)
      ? { relations: doc.relations, positions: doc.positions ?? {} }
      : { relations: [], positions: {} }
  },

  async writeRelations(id: string, doc: RelationsDoc): Promise<void> {
    await repo.write(paths.module(gm(), id, 'relations'), doc)
  },

  async readTimeline(id: string): Promise<TimelineDoc> {
    const doc = (await repo.read(paths.module(gm(), id, 'timeline'))) as TimelineDoc | null
    return doc && Array.isArray(doc.columns)
      ? { columns: doc.columns, events: Array.isArray(doc.events) ? doc.events : [] }
      : { columns: [], events: [] }
  },

  async writeTimeline(id: string, doc: TimelineDoc): Promise<void> {
    await repo.write(paths.module(gm(), id, 'timeline'), doc)
  },
}
