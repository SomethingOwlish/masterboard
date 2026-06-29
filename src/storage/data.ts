// Typed data-access over the repository. Centralizes the GM-handle resolution and
// the path layout so stores never touch raw paths. When no GM handle is set
// (purely-local use before GitHub is configured) we file everything under
// `local`, so configuring sync later is a matter of pointing at a repo.

import type { Campaign, CampaignSummary, ModuleId, SessionRecap } from '../model/types'
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
    const mods: ModuleId[] = ['campaign', 'log', 'characters', 'npcs', 'locations', 'misc']
    await Promise.all(mods.map((m) => repo.remove(paths.module(g, id, m))))
  },

  async readRecaps(id: string): Promise<SessionRecap[]> {
    const list = (await repo.read(paths.module(gm(), id, 'log'))) as SessionRecap[] | null
    return Array.isArray(list) ? list : []
  },

  async writeRecaps(id: string, recaps: SessionRecap[]): Promise<void> {
    await repo.write(paths.module(gm(), id, 'log'), recaps)
  },

  /** Generic JSON-array module reader used by simple list modules. */
  async readModuleArray<T>(id: string, mod: ModuleId): Promise<T[]> {
    const list = (await repo.read(paths.module(gm(), id, mod))) as T[] | null
    return Array.isArray(list) ? list : []
  },
}
