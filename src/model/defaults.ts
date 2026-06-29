// Factories for fresh domain objects so creation logic lives in one place.

import { newId } from './ids'
import type { Campaign, CampaignSettings, ThemeId } from './types'

export function defaultSettings(theme: ThemeId = 'parchment'): CampaignSettings {
  return {
    theme,
    accent: '',
    sourceSites: [],
    taskSite: null,
    miscKinds: ['note', 'item'],
    storage: {},
  }
}

export interface NewCampaignInput {
  name: string
  cover?: string
  theme?: ThemeId
}

export function makeCampaign(input: NewCampaignInput, now: string): Campaign {
  return {
    id: newId('camp'),
    name: input.name.trim(),
    cover: input.cover?.trim() || undefined,
    createdAt: now,
    settings: defaultSettings(input.theme),
    nextSession: { attendees: [], agenda: '' },
  }
}
