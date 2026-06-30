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
  SessionDoc,
  SessionRecap,
  SessionsIndex,
  TimelineDoc,
} from '../model/types'
import type { Json } from '../adapters/types'
import { useConfig } from '../store/config'
import { useCampaign } from '../store/campaign'
import { paths } from './paths'
import { repo } from './repository'

function gm(): string {
  return useConfig.getState().config.gmHandle || 'local'
}

// Content modules a GM may mark read-only (storage backend 'source-readonly') from
// Campaign settings — e.g. data fed by an import they don't want overwritten. The
// `campaign` file is never lockable (it holds the storage setting itself, so locking
// it would be a one-way trip), and infrastructure files (activity, sessions, rules)
// stay writable too.
const LOCKABLE: ModuleId[] = ['characters', 'npcs', 'locations', 'misc', 'relations', 'timeline', 'log', 'tasks']

/** Whether a module write should be skipped because the GM locked it read-only. */
function isLocked(id: string, mod: ModuleId): boolean {
  if (!LOCKABLE.includes(mod)) return false
  const c = useCampaign.getState().campaign
  if (!c || c.id !== id) return false
  return c.settings.storage?.[mod] === 'source-readonly'
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
    // Remove each session document before the sessions index that lists them.
    const sessionsIndex = await this.readSessionsIndex(id)
    await Promise.all(sessionsIndex.sessions.map((s) => repo.remove(paths.sessionDoc(g, id, s.id))))
    const mods: ModuleId[] = [
      'campaign', 'log', 'characters', 'npcs', 'locations', 'misc', 'relations',
      'timeline', 'activity', 'sessions', 'tasks', 'rules',
    ]
    await Promise.all(mods.map((m) => repo.remove(paths.module(g, id, m))))
  },

  async readRecaps(id: string): Promise<SessionRecap[]> {
    const list = (await repo.read(paths.module(gm(), id, 'log'))) as SessionRecap[] | null
    return Array.isArray(list) ? list : []
  },

  async writeRecaps(id: string, recaps: SessionRecap[]): Promise<void> {
    if (isLocked(id, 'log')) return
    await repo.write(paths.module(gm(), id, 'log'), recaps)
  },

  // Rules live in rules.md as raw markdown (the GitHub adapter stores `.md` paths
  // as text, not JSON), so these read/write a plain string rather than an object.
  async readRules(id: string): Promise<string> {
    const md = await repo.read(paths.module(gm(), id, 'rules'))
    return typeof md === 'string' ? md : ''
  },

  async writeRules(id: string, markdown: string): Promise<void> {
    await repo.write(paths.module(gm(), id, 'rules'), markdown)
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
    if (isLocked(id, mod)) return
    await repo.write(paths.module(gm(), id, mod), items as unknown as Json)
  },

  async readRelations(id: string): Promise<RelationsDoc> {
    const doc = (await repo.read(paths.module(gm(), id, 'relations'))) as RelationsDoc | null
    return doc && Array.isArray(doc.relations)
      ? { relations: doc.relations, positions: doc.positions ?? {} }
      : { relations: [], positions: {} }
  },

  async writeRelations(id: string, doc: RelationsDoc): Promise<void> {
    if (isLocked(id, 'relations')) return
    await repo.write(paths.module(gm(), id, 'relations'), doc)
  },

  async readTimeline(id: string): Promise<TimelineDoc> {
    const doc = (await repo.read(paths.module(gm(), id, 'timeline'))) as TimelineDoc | null
    return doc && Array.isArray(doc.columns)
      ? { columns: doc.columns, events: Array.isArray(doc.events) ? doc.events : [] }
      : { columns: [], events: [] }
  },

  async writeTimeline(id: string, doc: TimelineDoc): Promise<void> {
    if (isLocked(id, 'timeline')) return
    await repo.write(paths.module(gm(), id, 'timeline'), doc)
  },

  async readSessionsIndex(id: string): Promise<SessionsIndex> {
    const doc = (await repo.read(paths.module(gm(), id, 'sessions'))) as SessionsIndex | null
    return doc && Array.isArray(doc.sessions)
      ? { sessions: doc.sessions, nextSeq: typeof doc.nextSeq === 'number' ? doc.nextSeq : doc.sessions.length + 1 }
      : { sessions: [], nextSeq: 1 }
  },

  async writeSessionsIndex(id: string, index: SessionsIndex): Promise<void> {
    await repo.write(paths.module(gm(), id, 'sessions'), index)
  },

  async readSession(id: string, sessionId: string): Promise<SessionDoc | null> {
    return (await repo.read(paths.sessionDoc(gm(), id, sessionId))) as SessionDoc | null
  },

  async writeSession(id: string, doc: SessionDoc): Promise<void> {
    await repo.write(paths.sessionDoc(gm(), id, doc.id), doc)
  },

  async removeSession(id: string, sessionId: string): Promise<void> {
    await repo.remove(paths.sessionDoc(gm(), id, sessionId))
  },
}
