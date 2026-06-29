// Builds the repo-relative paths from DESIGN.md §3. Isolation is by GM handle:
// every path lives under <gm>/campaigns/... so multiple GMs share one repo.

import type { ModuleId } from '../model/types'

/** File name on disk for each persisted module. */
const MODULE_FILE: Record<ModuleId, string> = {
  campaign: 'campaign.json',
  characters: 'characters.json',
  npcs: 'npcs.json',
  locations: 'locations.json',
  misc: 'misc.json',
  relations: 'relations.json',
  timeline: 'timeline.json',
  log: 'log.json',
  tasks: 'tasks.json',
  rules: 'rules.md',
  sessions: 'sessions/index.json',
  activity: 'activity.json',
}

export const paths = {
  campaignsIndex: (gm: string) => `${gm}/campaigns/index.json`,
  campaignDir: (gm: string, id: string) => `${gm}/campaigns/${id}`,
  module: (gm: string, id: string, mod: ModuleId) => `${gm}/campaigns/${id}/${MODULE_FILE[mod]}`,
  sessionDoc: (gm: string, id: string, sessionId: string) =>
    `${gm}/campaigns/${id}/sessions/${sessionId}.json`,
}
