// Core domain model — mirrors DESIGN.md §4. These types are the contract every
// module persists against; storage adapters only ever see JSON shaped like this.

export type ID = string
export type ImgRef = string // Imgur URL
export type Tag = string

/** Bidirectional reference between entities. */
export interface Link {
  toId: ID
  kind?: string
}

export interface Field {
  id: ID
  label: string
  value: string
  type: 'text' | 'number' | 'longtext'
}

export type ThemeId = 'parchment' | 'dark' | 'contrast' | 'neon'

/** Module storage backends (per-module override, set in Campaign Settings). */
export type StorageBackend = 'repo-file' | 'imgur' | 'source-readonly' | 'separate-md'

/** Identifiers for every persisted module file in a campaign folder. */
export type ModuleId =
  | 'campaign'
  | 'characters'
  | 'npcs'
  | 'locations'
  | 'misc'
  | 'relations'
  | 'timeline'
  | 'log'
  | 'tasks'
  | 'rules'
  | 'sessions'
  | 'activity'

export interface SourceSite {
  id: ID
  label: string
  url: string
}

export interface CampaignSettings {
  theme: ThemeId
  accent: string
  sourceSites: SourceSite[] // the two read-from sites
  taskSite: { repo: string; path: string } | null // the third (write tasks)
  miscKinds: string[] // GM-defined Misc kinds
  storage: Partial<Record<ModuleId, StorageBackend>> // per-module override
}

/** Campaign-page planner: schedule the next real-world session. */
export interface NextSessionPlan {
  date?: string
  attendees: string[]
  agenda: string
  notes?: string
}

export interface Campaign {
  id: ID
  name: string
  cover?: ImgRef
  description?: string
  system?: string // game system, e.g. "SWADE", "VTM 5" — free-form so new ones can be added
  playerCount?: number // real-world players at the table
  plannedSessions?: number // sessions scheduled but not yet played
  createdAt: string
  lastPlayed?: string
  settings: CampaignSettings
  nextSession: NextSessionPlan
}

/** Lightweight entry stored in campaigns/index.json. */
export interface CampaignSummary {
  id: ID
  name: string
  cover?: ImgRef
  lastPlayed?: string
  createdAt: string
}

export interface Character {
  id: ID
  name: string
  playerName?: string
  portrait?: ImgRef
  fields: Field[]
  tags: Tag[]
  links: Link[]
}

export interface NPC {
  id: ID
  name: string
  portrait?: ImgRef
  fields: Field[]
  tags: Tag[]
  dead: boolean
  notes?: string
  links: Link[]
}

export interface Location {
  id: ID
  name: string
  description?: string
  image?: ImgRef
  tags: Tag[]
  links: Link[]
}

export interface Misc {
  id: ID
  kind: string
  name: string
  body?: string
  fields: Field[]
  tags: Tag[]
  links: Link[]
}

export interface Relation {
  id: ID
  fromId: ID
  toId: ID
  label: string
  directed: boolean
}

// In-world chronology (multi-column timeline).
export interface ChronoColumn {
  id: ID
  name: string
  fixed: boolean
  order: number
  minimized: boolean
}

export interface ChronoEvent {
  id: ID
  columnId: ID
  date: string
  title: string
  body?: string
  links: Link[]
}

/** Reverse-chronological recap of a past session (campaign chronology as prose). */
export interface SessionRecap {
  id: ID
  sessionId?: ID
  realDate: string
  seq: number
  title: string
  body: string
}

export interface Scene {
  id: ID
  name: string
  x: number
  y: number
  members: Link[]
}

export interface SessionDoc {
  id: ID
  name: string
  realDate: string
  seq: number
  canvas: unknown // tldraw snapshot
  scenes: Scene[]
}

/** One entry in a campaign's activity log (changelog of edits in the app). */
export interface ActivityEntry {
  id: ID
  at: string // ISO timestamp
  action: string // short human-readable summary, e.g. "Added recap"
  detail?: string // optional specifics, e.g. the recap title
}

export interface Task {
  id: ID
  title: string
  body?: string
  status: 'todo' | 'doing' | 'done'
  links: Link[]
  externalRef?: { url: string; id?: string }
}
