import type { LocalCampaignRecord } from './types'

/**
 * The newest version of each open campaign, as `useLocalCampaign` holds it.
 * Callbacks that outlive the screen that made them (the «Отменить» of a
 * delete toast) read it here instead of a stale copy.
 */
const latest = new Map<string, LocalCampaignRecord>()

export const rememberCampaign = (campaign: LocalCampaignRecord) => { latest.set(campaign.id, campaign) }
export const forgetCampaign = (id: string) => { latest.delete(id) }
export const currentCampaign = (id: string): LocalCampaignRecord | undefined => latest.get(id)
