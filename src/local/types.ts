// Data model of the real local campaign workspace (`/local`).

export type LocalCampaignEntityType = 'character' | 'npc' | 'creature' | 'location' | 'faction' | 'rumor' | 'item' | 'audience' | 'note' | 'letter' | 'handout' | 'map' | 'home-rule'

export interface LocalCampaignEntity {
  id: string
  type: LocalCampaignEntityType
  name: string
  description: string
  tags: string[]
  visibility: 'master' | 'public'
  status: 'active' | 'inactive' | 'archived'
  /** Type-specific card fields, keyed by the field id from `ENTITY_FIELDS`. */
  fields: Record<string, string>
  origin: LocalEntityOrigin
}

export interface LocalEntityOrigin {
  kind: 'manual' | 'plan' | 'live' | 'inbox' | 'import'
  sessionId?: string
}

export interface LocalCampaignRelation {
  id: string
  fromId: string
  toId: string
  label: string
  type: LocalRelationType
  /** `directed` reads from → to; `mutual` holds both ways. */
  direction: 'directed' | 'mutual'
  visibility: 'master' | 'public'
}

export type LocalRelationType = 'alliance' | 'enmity' | 'debt' | 'kin' | 'belongs' | 'other'

export interface LocalStoryArc {
  id: string
  title: string
  direction: string
  stakes: string
  status: 'planned' | 'active' | 'paused' | 'resolved' | 'cancelled'
  /** Why the arc was paused or cancelled. */
  statusReason: string
  progress: number
  owner: string
  mode: 'background' | 'foreground'
}

export interface LocalClockChange { id: string; delta: number; reason: string; createdAt: string; note?: string }
export interface LocalClockThreshold { id: string; at: number; consequence: string; reachedAt?: string }
export interface LocalCampaignClock {
  id: string
  title: string
  kind: 'threat' | 'goal' | 'project' | 'world'
  value: number
  segments: number
  visibility: 'master' | 'public'
  trigger: string
  advanceCondition: string
  rollbackCondition: string
  thresholds: LocalClockThreshold[]
  /** `fired` — the GM confirmed the trigger; `deferred` — full, confirmation postponed. */
  triggerStatus: 'idle' | 'deferred' | 'fired'
  firedAt?: string
  arcId: string
  entityIds: string[]
  secretIds: string[]
  history: LocalClockChange[]
}

export interface LocalCampaignSecret {
  id: string
  title: string
  truth: string
  publicVersion: string
  recipients: string
  status: LocalSecretStatus
  revealCondition: string
  entityIds: string[]
  clockIds: string[]
  sessionIds: string[]
  reveals: LocalSecretReveal[]
}

export type LocalSecretStatus = 'hidden' | 'partial' | 'selected' | 'everyone' | 'disproved' | 'obsolete'
export interface LocalSecretReveal { id: string; status: LocalSecretStatus; recipients: string; sessionId?: string; note: string; createdAt: string }

export interface LocalCampaignTask {
  id: string
  text: string
  source: 'masterboard' | 'preparation' | 'inbox' | 'session' | 'review' | 'clock'
  done: boolean
  origin?: LocalTaskOrigin
}

export interface LocalTaskOrigin { sessionId?: string; planItemId?: string; logEntryId?: string; entityId?: string; clockId?: string }

export interface LocalInboxItem { id: string; text: string; tags: string[]; createdAt: string }

export type LocalLogKind = 'moment' | 'decision' | 'reveal' | 'roll' | 'clock' | 'entity'
export interface LocalSessionLogEntry {
  id: string
  text: string
  kind: LocalLogKind
  createdAt: string
  clockId?: string
  secretId?: string
  entityId?: string
}

export interface LocalSessionFlow {
  id: string
  fromItemId: string
  toItemId: string
  condition: string
}

export type LocalSessionPlanKind = 'scene' | 'idea' | 'goal' | 'event' | 'question' | 'secret' | 'npc' | 'material' | 'note' | 'consequence'
export interface LocalSessionPlanItem {
  id: string
  source: 'library' | 'text'
  entityId?: string
  /** Set when the item stands for a campaign secret. */
  secretId?: string
  text: string
  kind: LocalSessionPlanKind
  priority: 'required' | 'desired' | 'useful' | 'backup'
  status: 'prepared' | 'current' | 'used' | 'skipped' | 'moved' | 'cancelled'
  role: string
  alternative: string
  note: string
  origin: 'prepared' | 'live' | 'review'
  /** Session the item was carried over from during a review. */
  carriedFromSessionId?: string
}

export interface LocalSessionRecord {
  id: string
  number: number
  title: string
  status: 'draft' | 'ready' | 'active' | 'completed'
  master: string
  arcId: string
  backgroundArcIds: string[]
  group: string
  participants: string
  inGameTime: string
  timelinePosition: string
  idea: string
  focus: string
  opening: string
  lines: string
  layers: string
  systems: string
  planItems: LocalSessionPlanItem[]
  flows: LocalSessionFlow[]
  log: LocalSessionLogEntry[]
  reviewNotes: string
  reviewStatus: 'draft' | 'completed'
  reviewDecisions: Record<string, LocalReviewDecision>
  /** Decisions already applied, so reopening and re-closing a review is safe. */
  appliedDecisions: Record<string, LocalReviewDecision>
  nextSessionId?: string
  createdAt: string
}

export type LocalReviewDecision = 'carry' | 'library' | 'cancel' | 'keep'

export interface LocalCampaignRecord {
  id: string
  name: string
  idea: string
  activeTime: string
  masters: string
  notes: string[]
  sessionRecords: LocalSessionRecord[]
  activeSessionId?: string
  entities: LocalCampaignEntity[]
  relations: LocalCampaignRelation[]
  storyArcs: LocalStoryArc[]
  clocks: LocalCampaignClock[]
  secrets: LocalCampaignSecret[]
  tasks: LocalCampaignTask[]
  inbox: LocalInboxItem[]
  /** Saved node positions of the relation graph, by entity id. */
  relationLayout: Record<string, { x: number; y: number }>
  createdAt: string
  updatedAt: string
}
