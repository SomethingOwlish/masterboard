// Open-campaign state (B2). Loads one campaign's record, its recap log, and the
// PC roster (read-only here; editing arrives in B3). Edits write through the
// repository immediately and keep the Hub index summary in sync.

import { create } from 'zustand'
import { newId } from '../model/ids'
import type { Campaign, Character, NextSessionPlan, SessionRecap } from '../model/types'
import { data } from '../storage/data'
import { useActivity } from './activity'

function logActivity(campaignId: string, action: string, detail?: string): void {
  void useActivity.getState().log(campaignId, action, detail)
}

interface CampaignState {
  id: string | null
  campaign: Campaign | null
  recaps: SessionRecap[]
  characters: Character[]
  loading: boolean
  notFound: boolean

  open: (id: string) => Promise<void>
  close: () => void

  setNextSession: (patch: Partial<NextSessionPlan>) => Promise<void>
  rename: (name: string) => Promise<void>
  /** Patch top-level campaign meta (description, system, cover, counters, …). */
  update: (patch: Partial<Campaign>) => Promise<void>

  addRecap: (input: { title: string; realDate: string; body: string }) => Promise<void>
  editRecap: (id: string, patch: Partial<SessionRecap>) => Promise<void>
  deleteRecap: (id: string) => Promise<void>

  addCharacter: (c: Character) => Promise<void>
  updateCharacter: (id: string, patch: Partial<Character>) => Promise<void>
  deleteCharacter: (id: string) => Promise<void>
}

function nextSeq(recaps: SessionRecap[]): number {
  return recaps.reduce((max, r) => Math.max(max, r.seq), 0) + 1
}

export const useCampaign = create<CampaignState>((set, get) => ({
  id: null,
  campaign: null,
  recaps: [],
  characters: [],
  loading: false,
  notFound: false,

  open: async (id) => {
    set({ loading: true, id, notFound: false, campaign: null, recaps: [], characters: [] })
    const campaign = await data.readCampaign(id)
    if (!campaign) {
      set({ loading: false, notFound: true })
      return
    }
    const [recaps, characters] = await Promise.all([
      data.readRecaps(id),
      data.readModuleArray<Character>(id, 'characters'),
    ])
    set({ campaign, recaps, characters, loading: false })
  },

  close: () => set({ id: null, campaign: null, recaps: [], characters: [], notFound: false }),

  setNextSession: async (patch) => {
    const { campaign } = get()
    if (!campaign) return
    const next = { ...campaign, nextSession: { ...campaign.nextSession, ...patch } }
    set({ campaign: next })
    await data.writeCampaign(next)
    // Only log discrete changes; agenda/notes typing is intentionally not logged.
    if ('date' in patch) logActivity(campaign.id, 'Set next-session date', patch.date || '(cleared)')
    if ('attendees' in patch) logActivity(campaign.id, 'Updated attendees', `${patch.attendees?.length ?? 0} player(s)`)
  },

  rename: async (name) => {
    const { campaign } = get()
    if (!campaign) return
    const trimmed = name.trim()
    if (!trimmed || trimmed === campaign.name) return
    const next = { ...campaign, name: trimmed }
    set({ campaign: next })
    await data.writeCampaign(next)
    await data.patchSummary(campaign.id, { name: trimmed })
    logActivity(campaign.id, 'Renamed campaign', `→ "${trimmed}"`)
  },

  update: async (patch) => {
    const { campaign } = get()
    if (!campaign) return
    const next = { ...campaign, ...patch }
    set({ campaign: next })
    await data.writeCampaign(next)
    // Keep the Hub index summary in sync when name/cover change.
    if ('name' in patch || 'cover' in patch) {
      await data.patchSummary(campaign.id, { name: next.name, cover: next.cover })
    }
    // Log discrete meta changes; free-text fields (description) are excluded to
    // avoid one entry per keystroke.
    if ('cover' in patch) logActivity(campaign.id, 'Changed cover image')
    if ('system' in patch) logActivity(campaign.id, 'Set game system', next.system || '(none)')
    if ('playerCount' in patch) logActivity(campaign.id, 'Set player count', String(next.playerCount ?? 0))
    if ('plannedSessions' in patch)
      logActivity(campaign.id, 'Set planned sessions', String(next.plannedSessions ?? 0))
  },

  addRecap: async ({ title, realDate, body }) => {
    const { campaign, recaps } = get()
    if (!campaign) return
    const recap: SessionRecap = { id: newId('recap'), realDate, seq: nextSeq(recaps), title, body }
    const next = [recap, ...recaps]
    set({ recaps: next })
    await data.writeRecaps(campaign.id, next)
    // The most recent recap's date is the campaign's "last played".
    await persistLastPlayed(campaign, next)
    logActivity(campaign.id, 'Added recap', `#${recap.seq} · ${title}`)
  },

  editRecap: async (id, patch) => {
    const { campaign, recaps } = get()
    if (!campaign) return
    const target = recaps.find((r) => r.id === id)
    const next = recaps.map((r) => (r.id === id ? { ...r, ...patch } : r))
    set({ recaps: next })
    await data.writeRecaps(campaign.id, next)
    await persistLastPlayed(campaign, next)
    if (target) logActivity(campaign.id, 'Edited recap', `#${target.seq} · ${patch.title ?? target.title}`)
  },

  deleteRecap: async (id) => {
    const { campaign, recaps } = get()
    if (!campaign) return
    const target = recaps.find((r) => r.id === id)
    const next = recaps.filter((r) => r.id !== id)
    set({ recaps: next })
    await data.writeRecaps(campaign.id, next)
    await persistLastPlayed(campaign, next)
    if (target) logActivity(campaign.id, 'Deleted recap', `#${target.seq} · ${target.title}`)
  },

  addCharacter: async (c) => {
    const { campaign, characters } = get()
    if (!campaign) return
    const next = [...characters, c]
    set({ characters: next })
    await data.writeModuleArray(campaign.id, 'characters', next)
    logActivity(campaign.id, 'Added character', c.name || '(unnamed)')
  },

  updateCharacter: async (id, patch) => {
    const { campaign, characters } = get()
    if (!campaign) return
    const next = characters.map((c) => (c.id === id ? { ...c, ...patch } : c))
    set({ characters: next })
    await data.writeModuleArray(campaign.id, 'characters', next)
  },

  deleteCharacter: async (id) => {
    const { campaign, characters } = get()
    if (!campaign) return
    const target = characters.find((c) => c.id === id)
    const next = characters.filter((c) => c.id !== id)
    set({ characters: next })
    await data.writeModuleArray(campaign.id, 'characters', next)
    if (target) logActivity(campaign.id, 'Deleted character', target.name || '(unnamed)')
  },
}))

/** Keep `lastPlayed` (campaign meta + index summary) pinned to the latest recap. */
async function persistLastPlayed(campaign: Campaign, recaps: SessionRecap[]): Promise<void> {
  const latest = recaps.reduce<string | undefined>(
    (acc, r) => (!acc || r.realDate > acc ? r.realDate : acc),
    undefined,
  )
  if (latest === campaign.lastPlayed) return
  const next = { ...campaign, lastPlayed: latest }
  useCampaign.setState({ campaign: next })
  await data.writeCampaign(next)
  await data.patchSummary(campaign.id, { lastPlayed: latest })
}
