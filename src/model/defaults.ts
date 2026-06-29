// Factories for fresh domain objects so creation logic lives in one place.

import { newId } from './ids'
import type {
  Campaign,
  CampaignSettings,
  Character,
  ChronoColumn,
  Field,
  NPC,
  ThemeId,
} from './types'

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

export function makeField(type: Field['type'] = 'text'): Field {
  return { id: newId('fld'), label: '', value: '', type }
}

export function makeCharacter(name = ''): Character {
  return { id: newId('pc'), name: name.trim(), playerName: '', fields: [], tags: [], links: [] }
}

export function makeNpc(name = ''): NPC {
  return { id: newId('npc'), name: name.trim(), fields: [], tags: [], dead: false, links: [] }
}

/** The default, undeletable "Campaign" chronology column (DESIGN.md M6). */
export function makeCampaignColumn(): ChronoColumn {
  return { id: newId('col'), name: 'Campaign', fixed: true, order: 0, minimized: false }
}

export function makeColumn(name: string, order: number): ChronoColumn {
  return { id: newId('col'), name: name.trim(), fixed: false, order, minimized: false }
}
