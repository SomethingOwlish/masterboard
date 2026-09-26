// Data model of the real local campaign workspace (`/local`).

import type { ExternalSystem, PublicationQueueItem } from '../model/external'

export type LocalCampaignEntityType = 'character' | 'npc' | 'creature' | 'location' | 'faction' | 'rumor' | 'item' | 'audience' | 'note' | 'letter' | 'handout' | 'map' | 'home-rule'

export interface LocalCampaignEntity {
  id: string
  type: LocalCampaignEntityType
  name: string
  description: string
  tags: string[]
  visibility: 'master' | 'public'
  status: 'active' | 'inactive' | 'archived'
  /** NPC only: the character has died. Kept apart from `status` so a dead NPC can still be active in the story. */
  dead?: boolean
  /** Type-specific card fields, keyed by the field id from `ENTITY_FIELDS`. */
  fields: Record<string, string>
  origin: LocalEntityOrigin
  /** Records in lorebook / lovegame / systemsetup this entity was imported from or published to. */
  sources: EntitySource[]
}

/** The part of an entity that travels between Masterboard and another system. */
export interface EntitySnapshot {
  name: string
  description: string
  tags: string[]
  fields: Record<string, string>
  visibility: 'master' | 'public'
}

/**
 * Link to a record in another system (decision F2). `snapshot` is the entity as
 * both sides last agreed on it — the base for the field-by-field comparison on refresh.
 */
export interface EntitySource {
  system: ExternalSystem
  /** World / campaign / system on the other side. */
  containerId: string
  /** Record id on the other side. */
  id: string
  /** Record type on the other side. */
  type: string
  url?: string
  /** Other side's time of change (ms) when last read or written. */
  updatedAt: number
  syncedAt: string
  snapshot: EntitySnapshot
}

/** World / campaign on the other side this campaign is linked to (decision F4: set by the owner). */
export interface CampaignLink {
  externalId: string
  label: string
  url?: string
}

export interface LocalEntityOrigin {
  kind: 'manual' | 'plan' | 'live' | 'inbox' | 'import' | 'improv'
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
  /** Free-text recipients in addition to `recipientIds`. */
  recipients: string
  /** Players and groups who know the secret. */
  recipientIds: string[]
  status: LocalSecretStatus
  revealCondition: string
  entityIds: string[]
  clockIds: string[]
  sessionIds: string[]
  reveals: LocalSecretReveal[]
}

export type LocalSecretStatus = 'hidden' | 'partial' | 'selected' | 'everyone' | 'disproved' | 'obsolete'
export interface LocalSecretReveal { id: string; status: LocalSecretStatus; recipients: string; recipientIds: string[]; sessionId?: string; note: string; createdAt: string }

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
  /** Scene (another plan item of kind `scene`) this item belongs to on the scene board. */
  sceneId?: string
}

export interface LocalSessionRecord {
  id: string
  number: number
  title: string
  status: 'draft' | 'ready' | 'active' | 'completed'
  /** Responsible master (`LocalMaster.id`). */
  masterId: string
  handovers: LocalHandover[]
  arcId: string
  backgroundArcIds: string[]
  groupId: string
  /** Players invited from outside the main group. */
  guestPlayerIds: string[]
  /** Free-text note about who plays. */
  participants: string
  /** Real-world play date, `YYYY-MM-DD`, or `''` when not scheduled. */
  date: string
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
  /** Node positions of the transitions graph, by plan item id. */
  planLayout: Record<string, { x: number; y: number }>
  printConfig: LocalPrintConfig
  createdAt: string
  /** Set while the session is in the trash; it keeps its number and can be restored. */
  deletedAt?: string
}

/** `email` is the Cloudflare Access login; it links a master to a signed-in person in shared campaigns. */
export interface LocalMaster { id: string; name: string; role: 'owner' | 'co-master'; email?: string }
export interface LocalPlayer { id: string; name: string; characterIds: string[]; note: string }
export interface LocalGroup { id: string; name: string; playerIds: string[] }
export interface LocalHandover { id: string; fromId: string; toId: string; byId: string; createdAt: string }

export type LocalImprovKind = 'name' | 'npc' | 'location' | 'item' | 'event' | 'complication'
export interface LocalImprovItem { id: string; masterId: string; kind: LocalImprovKind; text: string; usedAt?: string; usedSessionId?: string; entityId?: string }

export type LocalWidgetId = 'session' | 'arcs' | 'clocks' | 'secrets' | 'tasks' | 'inbox'
export interface LocalDashboardLayout { order: LocalWidgetId[]; hidden: LocalWidgetId[]; wide: LocalWidgetId[] }

export interface LocalPrintConfig {
  priorities: Array<LocalSessionPlanItem['priority']>
  passport: boolean
  entities: boolean
  secrets: boolean
  clocks: boolean
  flows: boolean
  notes: boolean
}

export type LocalReviewDecision = 'carry' | 'library' | 'cancel' | 'keep'

export interface LocalCampaignRecord {
  id: string
  name: string
  idea: string
  activeTime: string
  masters: LocalMaster[]
  players: LocalPlayer[]
  groups: LocalGroup[]
  archived: boolean
  /** Personal improv sheets; each item belongs to one master. */
  improv: LocalImprovItem[]
  /** Personal overview layouts, by master id. */
  dashboardLayouts: Record<string, LocalDashboardLayout>
  /** Batch publication queue to lorebook / lovegame. */
  publications: PublicationQueueItem[]
  /** Where this campaign reads from and publishes to, per system. */
  integrations: Partial<Record<ExternalSystem, CampaignLink>>
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
