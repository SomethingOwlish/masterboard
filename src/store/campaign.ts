// Open-campaign state (B2). Loads one campaign's record, its recap log, and the
// PC roster (read-only here; editing arrives in B3). Edits write through the
// repository immediately and keep the Hub index summary in sync.

import { create } from 'zustand'
import { newId } from '../model/ids'
import type { Campaign, Character, NextSessionPlan, SessionRecap } from '../model/types'
import { data } from '../storage/data'

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
  },

  editRecap: async (id, patch) => {
    const { campaign, recaps } = get()
    if (!campaign) return
    const next = recaps.map((r) => (r.id === id ? { ...r, ...patch } : r))
    set({ recaps: next })
    await data.writeRecaps(campaign.id, next)
    await persistLastPlayed(campaign, next)
  },

  deleteRecap: async (id) => {
    const { campaign, recaps } = get()
    if (!campaign) return
    const next = recaps.filter((r) => r.id !== id)
    set({ recaps: next })
    await data.writeRecaps(campaign.id, next)
    await persistLastPlayed(campaign, next)
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
