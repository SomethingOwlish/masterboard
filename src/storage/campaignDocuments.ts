import type { DocumentData } from './gateway'

export type CampaignMode = 'single-group' | 'groups'

export interface CampaignDocument extends DocumentData {
  name: string
  idea?: string
  mode: CampaignMode
  ownerId: string
  coMasterId?: string
  activeTime?: string
  createdAt: string
  updatedAt: string
}

export function canAccessCampaign(campaign: CampaignDocument, masterId: string): boolean {
  return campaign.ownerId === masterId || campaign.coMasterId === masterId
}

export function canManageCampaign(campaign: CampaignDocument, masterId: string): boolean {
  return campaign.ownerId === masterId
}
