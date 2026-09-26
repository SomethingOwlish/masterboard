import type { LocalCampaignRecord, LocalReviewDecision, LocalSessionFlow, LocalSessionLogEntry, LocalSessionPlanItem, LocalSessionRecord } from './types'

type Raw = Record<string, unknown>

const isObject = (value: unknown): value is Raw => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])
const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

const PRIORITIES = ['required', 'desired', 'useful', 'backup'] as const
const USE_STATUSES = ['prepared', 'current', 'used', 'skipped', 'moved', 'cancelled'] as const
const SESSION_STATUSES = ['draft', 'ready', 'active', 'completed'] as const
const PLAN_KINDS = ['scene', 'idea', 'goal', 'event', 'question', 'secret', 'npc', 'material', 'note', 'consequence'] as const

export function blankSession(number: number, master: string, now: string, id = `session-${crypto.randomUUID()}`): LocalSessionRecord {
  return { id, number, title: '', status: 'draft', master, arcId: '', group: '', participants: '', inGameTime: '', timelinePosition: '', idea: '', focus: '', opening: '', lines: '', layers: '', systems: '', planItems: [], flows: [], log: [], reviewNotes: '', reviewStatus: 'draft', reviewDecisions: {}, createdAt: now }
}

function normalizePlanItem(raw: unknown): LocalSessionPlanItem | null {
  if (!isObject(raw) || typeof raw.id !== 'string') return null
  return {
    id: raw.id,
    source: raw.source === 'library' ? 'library' : 'text',
    entityId: typeof raw.entityId === 'string' ? raw.entityId : undefined,
    text: text(raw.text),
    kind: oneOf(raw.kind, PLAN_KINDS, 'note'),
    priority: oneOf(raw.priority, PRIORITIES, 'desired'),
    status: oneOf(raw.status, USE_STATUSES, 'prepared'),
    role: text(raw.role),
    alternative: text(raw.alternative),
    note: text(raw.note),
    origin: oneOf(raw.origin, ['prepared', 'live', 'review'] as const, 'prepared'),
  }
}

function normalizeSession(raw: unknown, index: number, fallbackDate: string): LocalSessionRecord | null {
  if (!isObject(raw) || typeof raw.id !== 'string') return null
  const base = blankSession(typeof raw.number === 'number' ? raw.number : index + 1, text(raw.master), text(raw.createdAt, fallbackDate), raw.id)
  return {
    ...base,
    title: text(raw.title),
    status: oneOf(raw.status, SESSION_STATUSES, 'draft'),
    arcId: text(raw.arcId), group: text(raw.group), participants: text(raw.participants),
    inGameTime: text(raw.inGameTime), timelinePosition: text(raw.timelinePosition),
    idea: text(raw.idea), focus: text(raw.focus), opening: text(raw.opening),
    lines: text(raw.lines), layers: text(raw.layers), systems: text(raw.systems),
    planItems: list(raw.planItems).map(normalizePlanItem).filter((item): item is LocalSessionPlanItem => item !== null),
    flows: list<LocalSessionFlow>(raw.flows),
    log: list<LocalSessionLogEntry>(raw.log),
    reviewNotes: text(raw.reviewNotes),
    reviewStatus: raw.reviewStatus === 'completed' ? 'completed' : 'draft',
    reviewDecisions: isObject(raw.reviewDecisions) ? (raw.reviewDecisions as Record<string, LocalReviewDecision>) : {},
  }
}

/** Builds the session list for records saved before multi-session support (`firstSession*` fields). */
function legacySessions(raw: Raw, fallbackDate: string): LocalSessionRecord[] {
  const title = text(raw.firstSessionTitle)
  if (!title) return []
  const scenes = list<Raw>(raw.firstSessionScenes).filter(isObject).map((scene): LocalSessionPlanItem => ({
    id: text(scene.id, `plan-${crypto.randomUUID()}`), source: 'text', text: text(scene.title), kind: oneOf(scene.kind, PLAN_KINDS, 'scene'),
    priority: oneOf(scene.priority, PRIORITIES, 'desired'), status: oneOf(scene.status, USE_STATUSES, 'prepared'),
    role: '', alternative: '', note: text(scene.purpose), origin: 'prepared',
  }))
  const linked = list<Raw>(raw.firstSessionItems).filter(isObject).map((item): LocalSessionPlanItem => ({
    id: text(item.id, `plan-${crypto.randomUUID()}`), source: 'library', entityId: text(item.entityId), text: '', kind: 'note',
    priority: oneOf(item.priority, PRIORITIES, 'desired'), status: oneOf(item.status, USE_STATUSES, 'prepared'),
    role: text(item.role), alternative: text(item.alternative), note: text(item.note), origin: 'prepared',
  }))
  return [{
    ...blankSession(1, text(raw.firstSessionMaster, text(raw.masters)), text(raw.updatedAt, fallbackDate), 'session-1'),
    title,
    status: oneOf(raw.firstSessionStatus, SESSION_STATUSES, 'draft'),
    arcId: text(raw.firstSessionArcId), inGameTime: text(raw.firstSessionInGameTime), idea: text(raw.firstSessionIdea),
    focus: text(raw.firstSessionObjective), opening: text(raw.firstSessionOpening),
    planItems: [...scenes, ...linked],
    flows: list<LocalSessionFlow>(raw.firstSessionFlows),
    log: list<LocalSessionLogEntry>(raw.firstSessionLog),
    reviewNotes: text(raw.firstSessionReviewNotes),
    reviewStatus: raw.firstSessionReviewStatus === 'completed' ? 'completed' : 'draft',
    reviewDecisions: isObject(raw.firstSessionReviewDecisions) ? (raw.firstSessionReviewDecisions as Record<string, LocalReviewDecision>) : {},
  }]
}

/**
 * Validates a stored campaign and upgrades it to the current model. Returns
 * `null` when the value cannot be a campaign; the caller quarantines it.
 */
export function normalizeCampaign(value: unknown, now: string): LocalCampaignRecord | null {
  if (!isObject(value) || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string') return null
  const updatedAt = text(value.updatedAt, now)
  const stored = list(value.sessionRecords).map((session, index) => normalizeSession(session, index, updatedAt)).filter((session): session is LocalSessionRecord => session !== null)
  const sessionRecords = stored.length ? stored : legacySessions(value, updatedAt)
  const activeSessionId = typeof value.activeSessionId === 'string' && sessionRecords.some((session) => session.id === value.activeSessionId) ? value.activeSessionId : sessionRecords[0]?.id
  return {
    id: value.id,
    name: value.name,
    idea: text(value.idea),
    activeTime: text(value.activeTime, 'Время ещё не задано'),
    masters: text(value.masters),
    notes: list<unknown>(value.notes).filter((note): note is string => typeof note === 'string'),
    sessionRecords,
    activeSessionId,
    entities: list<Raw>(value.entities).filter(isObject).map((entity) => ({ ...entity, tags: list<string>(entity.tags), visibility: entity.visibility ?? 'master', status: entity.status ?? 'active' })) as unknown as LocalCampaignRecord['entities'],
    relations: list(value.relations),
    storyArcs: list<Raw>(value.storyArcs).filter(isObject).map((arc) => ({ ...arc, owner: text(arc.owner), mode: arc.mode === 'background' ? 'background' : 'foreground' })) as unknown as LocalCampaignRecord['storyArcs'],
    clocks: list<Raw>(value.clocks).filter(isObject).map((clock) => ({ ...clock, history: list(clock.history), advanceCondition: text(clock.advanceCondition), rollbackCondition: text(clock.rollbackCondition) })) as unknown as LocalCampaignRecord['clocks'],
    secrets: list<Raw>(value.secrets).filter(isObject).map((secret) => ({ ...secret, revealCondition: text(secret.revealCondition) })) as unknown as LocalCampaignRecord['secrets'],
    tasks: list(value.tasks),
    inbox: list(value.inbox),
    createdAt: text(value.createdAt, updatedAt),
    updatedAt,
  }
}

export function withLocalSessions(campaign: LocalCampaignRecord, sessions: LocalSessionRecord[], activeSessionId?: string): LocalCampaignRecord {
  return { ...campaign, sessionRecords: sessions, activeSessionId: activeSessionId ?? campaign.activeSessionId ?? sessions[0]?.id }
}

/** The campaign dashboard opens once the first session exists. */
export const isCampaignReady = (campaign: LocalCampaignRecord): boolean => campaign.sessionRecords.length > 0
