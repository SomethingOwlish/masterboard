// Hub state (M1): the GM's campaign list plus create/duplicate/delete. The index
// file is the source of truth for the list; each campaign's full record lives in
// its own campaign.json.

import { create } from 'zustand'
import { makeCampaign, type NewCampaignInput } from '../model/defaults'
import type { Campaign, CampaignSummary } from '../model/types'
import { data } from '../storage/data'
import { useActivity } from './activity'

function nowIso(): string {
  return new Date().toISOString()
}

function summarize(c: Campaign): CampaignSummary {
  return { id: c.id, name: c.name, cover: c.cover, lastPlayed: c.lastPlayed, createdAt: c.createdAt }
}

interface CampaignsState {
  campaigns: CampaignSummary[]
  loading: boolean
  loaded: boolean
  load: () => Promise<void>
  create: (input: NewCampaignInput) => Promise<Campaign>
  duplicate: (id: string) => Promise<Campaign | null>
  remove: (id: string) => Promise<void>
}

export const useCampaigns = create<CampaignsState>((set, get) => ({
  campaigns: [],
  loading: false,
  loaded: false,

  load: async () => {
    set({ loading: true })
    const campaigns = await data.listCampaigns()
    set({ campaigns, loading: false, loaded: true })
  },

  create: async (input) => {
    const campaign = makeCampaign(input, nowIso())
    await data.writeCampaign(campaign)
    const next = [...get().campaigns, summarize(campaign)]
    await data.saveCampaignsIndex(next)
    set({ campaigns: next })
    await useActivity.getState().log(campaign.id, 'Created campaign', campaign.name)
    return campaign
  },

  duplicate: async (id) => {
    const source = await data.readCampaign(id)
    if (!source) return null
    const copy = makeCampaign({ name: `${source.name} (copy)`, cover: source.cover }, nowIso())
    copy.settings = structuredClone(source.settings)
    copy.nextSession = structuredClone(source.nextSession)
    await data.writeCampaign(copy)
    const next = [...get().campaigns, summarize(copy)]
    await data.saveCampaignsIndex(next)
    set({ campaigns: next })
    return copy
  },

  remove: async (id) => {
    const next = get().campaigns.filter((c) => c.id !== id)
    await data.saveCampaignsIndex(next)
    await data.deleteCampaignFiles(id)
    set({ campaigns: next })
  },
}))
