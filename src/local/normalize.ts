import { newArc, newClock, newEntity, newSecret } from './domain'
import { newGroup, parseMasters } from './team'
import { WIDGETS } from './labels'
import { validSessionDate } from './sessions'
import { EXTERNAL_SYSTEMS, isExternalSystem, type ExternalSystem } from '../model/external'
import type { EntitySource, LocalCampaignEntity, LocalCampaignRecord, LocalDashboardLayout, LocalGroup, LocalWidgetId, LocalMaster, LocalPrintConfig, LocalReviewDecision, LocalSessionFlow, LocalSessionLogEntry, LocalSessionPlanItem, LocalSessionRecord } from './types'

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

export const defaultPrintConfig = (): LocalPrintConfig => ({ priorities: ['required', 'desired', 'useful', 'backup'], passport: true, entities: true, secrets: true, clocks: true, flows: true, notes: true })

export function blankSession(number: number, masterId: string, now: string, id = `session-${crypto.randomUUID()}`): LocalSessionRecord {
  return { id, number, title: '', status: 'draft', masterId, handovers: [], arcId: '', backgroundArcIds: [], groupId: '', guestPlayerIds: [], participants: '', date: '', inGameTime: '', timelinePosition: '', idea: '', focus: '', opening: '', lines: '', layers: '', systems: '', planItems: [], flows: [], log: [], reviewNotes: '', reviewStatus: 'draft', reviewDecisions: {}, appliedDecisions: {}, planLayout: {}, printConfig: defaultPrintConfig(), createdAt: now }
}

function normalizePlanItem(raw: unknown): LocalSessionPlanItem | null {
  if (!isObject(raw) || typeof raw.id !== 'string') return null
  return {
    id: raw.id,
    source: raw.source === 'library' ? 'library' : 'text',
    entityId: typeof raw.entityId === 'string' ? raw.entityId : undefined,
    secretId: typeof raw.secretId === 'string' ? raw.secretId : undefined,
    text: text(raw.text),
    kind: oneOf(raw.kind, PLAN_KINDS, 'note'),
    priority: oneOf(raw.priority, PRIORITIES, 'desired'),
    status: oneOf(raw.status, USE_STATUSES, 'prepared'),
    role: text(raw.role),
    alternative: text(raw.alternative),
    note: text(raw.note),
    origin: oneOf(raw.origin, ['prepared', 'live', 'review'] as const, 'prepared'),
    carriedFromSessionId: typeof raw.carriedFromSessionId === 'string' ? raw.carriedFromSessionId : undefined,
    sceneId: typeof raw.sceneId === 'string' ? raw.sceneId : undefined,
  }
}

/** Resolves pre-team fields (master and group stored as names) against the campaign team. */
interface TeamContext { masters: LocalMaster[]; groups: LocalGroup[] }
function masterIdFor(team: TeamContext, id: unknown, name: unknown): string {
  if (typeof id === 'string' && team.masters.some((master) => master.id === id)) return id
  const byName = typeof name === 'string' && team.masters.find((master) => master.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase())
  return (byName || team.masters.find((master) => master.role === 'owner') || team.masters[0]).id
}
function groupIdFor(team: TeamContext, id: unknown, name: unknown): string {
  if (typeof id === 'string') return id
  const title = text(name).trim()
  if (!title) return ''
  let group = team.groups.find((item) => item.name.toLocaleLowerCase() === title.toLocaleLowerCase())
  if (!group) { group = newGroup(title); team.groups.push(group) }
  return group.id
}
function normalizeLayout(raw: Raw): LocalDashboardLayout {
  const widgets = (value: unknown) => ids(value).filter((id): id is LocalWidgetId => (WIDGETS as readonly string[]).includes(id))
  const order = widgets(raw.order)
  return { order: [...order, ...WIDGETS.filter((id) => !order.includes(id))], hidden: widgets(raw.hidden), wide: widgets(raw.wide) }
}
const ids = (value: unknown): string[] => list<unknown>(value).filter((id): id is string => typeof id === 'string')

function normalizeSession(raw: unknown, index: number, fallbackDate: string, team: TeamContext): LocalSessionRecord | null {
  if (!isObject(raw) || typeof raw.id !== 'string') return null
  const base = blankSession(typeof raw.number === 'number' ? raw.number : index + 1, masterIdFor(team, raw.masterId, raw.master), text(raw.createdAt, fallbackDate), raw.id)
  return {
    ...base,
    title: text(raw.title),
    status: oneOf(raw.status, SESSION_STATUSES, 'draft'),
    arcId: text(raw.arcId), backgroundArcIds: list<unknown>(raw.backgroundArcIds).filter((id): id is string => typeof id === 'string'), groupId: groupIdFor(team, raw.groupId, raw.group), guestPlayerIds: ids(raw.guestPlayerIds), participants: text(raw.participants),
    handovers: list(raw.handovers),
    date: validSessionDate(text(raw.date)) ? text(raw.date) : '',
    inGameTime: text(raw.inGameTime), timelinePosition: text(raw.timelinePosition),
    idea: text(raw.idea), focus: text(raw.focus), opening: text(raw.opening),
    lines: text(raw.lines), layers: text(raw.layers), systems: text(raw.systems),
    planItems: list(raw.planItems).map(normalizePlanItem).filter((item): item is LocalSessionPlanItem => item !== null),
    flows: list<LocalSessionFlow>(raw.flows),
    log: list<LocalSessionLogEntry>(raw.log).map(normalizeLogEntry),
    reviewNotes: text(raw.reviewNotes),
    reviewStatus: raw.reviewStatus === 'completed' ? 'completed' : 'draft',
    reviewDecisions: isObject(raw.reviewDecisions) ? (raw.reviewDecisions as Record<string, LocalReviewDecision>) : {},
    appliedDecisions: isObject(raw.appliedDecisions) ? (raw.appliedDecisions as Record<string, LocalReviewDecision>) : {},
    nextSessionId: typeof raw.nextSessionId === 'string' ? raw.nextSessionId : undefined,
    planLayout: isObject(raw.planLayout) ? (raw.planLayout as LocalSessionRecord['planLayout']) : {},
    printConfig: isObject(raw.printConfig) ? { ...defaultPrintConfig(), ...(raw.printConfig as Partial<LocalPrintConfig>) } : defaultPrintConfig(),
    ...(typeof raw.deletedAt === 'string' && raw.deletedAt ? { deletedAt: raw.deletedAt } : {}),
  }
}

/** Builds the session list for records saved before multi-session support (`firstSession*` fields). */
function legacySessions(raw: Raw, fallbackDate: string, team: TeamContext): LocalSessionRecord[] {
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
    ...blankSession(1, masterIdFor(team, undefined, raw.firstSessionMaster), text(raw.updatedAt, fallbackDate), 'session-1'),
    title,
    status: oneOf(raw.firstSessionStatus, SESSION_STATUSES, 'draft'),
    arcId: text(raw.firstSessionArcId), inGameTime: text(raw.firstSessionInGameTime), idea: text(raw.firstSessionIdea),
    focus: text(raw.firstSessionObjective), opening: text(raw.firstSessionOpening),
    planItems: [...scenes, ...linked],
    flows: list<LocalSessionFlow>(raw.firstSessionFlows),
    log: list<LocalSessionLogEntry>(raw.firstSessionLog).map(normalizeLogEntry),
    reviewNotes: text(raw.firstSessionReviewNotes),
    reviewStatus: raw.firstSessionReviewStatus === 'completed' ? 'completed' : 'draft',
    reviewDecisions: isObject(raw.firstSessionReviewDecisions) ? (raw.firstSessionReviewDecisions as Record<string, LocalReviewDecision>) : {},
  }]
}

function normalizeLogEntry(entry: LocalSessionLogEntry): LocalSessionLogEntry {
  return { ...entry, kind: oneOf(entry.kind, ['moment', 'decision', 'reveal', 'roll', 'clock', 'entity'] as const, 'moment') }
}

function normalizeEntity(raw: Raw): LocalCampaignEntity {
  const tags = list<unknown>(raw.tags).filter((tag): tag is string => typeof tag === 'string')
  const origin = isObject(raw.origin) ? { kind: oneOf(raw.origin.kind, ['manual', 'plan', 'live', 'inbox', 'import', 'improv'] as const, 'manual'), sessionId: typeof raw.origin.sessionId === 'string' ? raw.origin.sessionId : undefined } : { kind: tags.includes('из сессии') ? 'plan' as const : 'manual' as const }
  return newEntity({
    id: raw.id as string,
    type: oneOf(raw.type, ['character', 'npc', 'creature', 'location', 'faction', 'rumor', 'item', 'audience', 'note', 'letter', 'handout', 'map', 'home-rule'] as const, 'note'),
    name: text(raw.name), description: text(raw.description), tags,
    visibility: raw.visibility === 'public' ? 'public' : 'master',
    status: oneOf(raw.status, ['active', 'inactive', 'archived'] as const, 'active'),
    ...(raw.dead === true && raw.type === 'npc' ? { dead: true } : {}),
    fields: stringMap(raw.fields),
    origin,
    sources: list<Raw>(raw.sources).filter((source) => isObject(source) && isExternalSystem(source.system) && typeof source.id === 'string' && typeof source.containerId === 'string').map(normalizeSource),
  })
}

const stringMap = (value: unknown): Record<string, string> => isObject(value) ? Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === 'string')) as Record<string, string> : {}

/**
 * Only for sources of a system this build knows — `normalizeEntity` filters the
 * rest out. The old fallback turned an unknown system into `lorebook`, and the
 * next publication would have written that record into the wrong world.
 */
function normalizeSource(raw: Raw): EntitySource {
  const snapshot = isObject(raw.snapshot) ? raw.snapshot : {}
  return {
    system: raw.system as ExternalSystem,
    containerId: raw.containerId as string, id: raw.id as string, type: text(raw.type),
    url: typeof raw.url === 'string' ? raw.url : undefined,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
    syncedAt: text(raw.syncedAt),
    snapshot: {
      name: text(snapshot.name), description: text(snapshot.description),
      tags: list<unknown>(snapshot.tags).filter((tag): tag is string => typeof tag === 'string'),
      fields: stringMap(snapshot.fields), visibility: snapshot.visibility === 'public' ? 'public' : 'master',
    },
  }
}

function normalizeLinks(value: unknown): LocalCampaignRecord['integrations'] {
  if (!isObject(value)) return {}
  const links: LocalCampaignRecord['integrations'] = {}
  for (const system of EXTERNAL_SYSTEMS) {
    const link = value[system]
    if (isObject(link) && typeof link.externalId === 'string') links[system] = { externalId: link.externalId, label: text(link.label, link.externalId), url: typeof link.url === 'string' ? link.url : undefined }
  }
  return links
}

/**
 * Validates a stored campaign and upgrades it to the current model. Returns
 * `null` when the value cannot be a campaign; the caller quarantines it.
 */
export function normalizeCampaign(value: unknown, now: string): LocalCampaignRecord | null {
  if (!isObject(value) || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string') return null
  const updatedAt = text(value.updatedAt, now)
  const storedMasters = list<Raw>(value.masters).filter((master) => isObject(master) && typeof master.id === 'string' && typeof master.name === 'string')
    .map((master): LocalMaster => ({ id: master.id as string, name: master.name as string, role: master.role === 'owner' ? 'owner' : 'co-master', ...(typeof master.email === 'string' && master.email.trim() ? { email: master.email.trim().toLocaleLowerCase() } : {}) }))
  const masters = storedMasters.length ? storedMasters : parseMasters(text(value.masters))
  if (!masters.some((master) => master.role === 'owner')) masters[0] = { ...masters[0], role: 'owner' }
  const team: TeamContext = {
    masters,
    groups: list<Raw>(value.groups).filter((group) => isObject(group) && typeof group.id === 'string').map((group) => ({ id: group.id as string, name: text(group.name), playerIds: ids(group.playerIds) })),
  }
  const stored = list(value.sessionRecords).map((session, index) => normalizeSession(session, index, updatedAt, team)).filter((session): session is LocalSessionRecord => session !== null)
  const sessionRecords = stored.length ? stored : legacySessions(value, updatedAt, team)
  const live = sessionRecords.filter((session) => !session.deletedAt)
  const activeSessionId = typeof value.activeSessionId === 'string' && live.some((session) => session.id === value.activeSessionId) ? value.activeSessionId : live[0]?.id
  return {
    id: value.id,
    name: value.name,
    idea: text(value.idea),
    activeTime: text(value.activeTime, 'Время ещё не задано'),
    masters,
    players: list<Raw>(value.players).filter((player) => isObject(player) && typeof player.id === 'string').map((player) => ({ id: player.id as string, name: text(player.name), characterIds: ids(player.characterIds), note: text(player.note) })),
    groups: team.groups,
    archived: value.archived === true,
    improv: list<Raw>(value.improv).filter((item) => isObject(item) && typeof item.id === 'string' && typeof item.text === 'string').map((item) => ({
      id: item.id as string, masterId: text(item.masterId, masters[0].id), text: item.text as string,
      kind: oneOf(item.kind, ['name', 'npc', 'location', 'item', 'event', 'complication'] as const, 'name'),
      usedAt: typeof item.usedAt === 'string' ? item.usedAt : undefined, usedSessionId: typeof item.usedSessionId === 'string' ? item.usedSessionId : undefined,
      entityId: typeof item.entityId === 'string' ? item.entityId : undefined,
    })),
    integrations: normalizeLinks(value.integrations),
    publications: list<Raw>(value.publications).filter((item) => isObject(item) && typeof item.id === 'string' && typeof item.entityId === 'string') as unknown as LocalCampaignRecord['publications'],
    dashboardLayouts: isObject(value.dashboardLayouts) ? Object.fromEntries(Object.entries(value.dashboardLayouts).filter(([, layout]) => isObject(layout)).map(([id, layout]) => [id, normalizeLayout(layout as Raw)])) : {},
    notes: list<unknown>(value.notes).filter((note): note is string => typeof note === 'string'),
    sessionRecords,
    activeSessionId,
    entities: list<Raw>(value.entities).filter((entity) => isObject(entity) && typeof entity.id === 'string').map(normalizeEntity),
    relations: list<Raw>(value.relations).filter((relation) => isObject(relation) && typeof relation.id === 'string').map((relation) => ({
      id: relation.id as string, fromId: text(relation.fromId), toId: text(relation.toId), label: text(relation.label),
      type: oneOf(relation.type, ['alliance', 'enmity', 'debt', 'kin', 'belongs', 'other'] as const, 'other'),
      direction: relation.direction === 'mutual' ? 'mutual' as const : 'directed' as const,
      visibility: relation.visibility === 'public' ? 'public' as const : 'master' as const,
    })),
    storyArcs: list<Raw>(value.storyArcs).filter((arc) => isObject(arc) && typeof arc.id === 'string').map((arc) => newArc({
      id: arc.id as string, title: text(arc.title), direction: text(arc.direction), stakes: text(arc.stakes),
      status: oneOf(arc.status, ['planned', 'active', 'paused', 'resolved', 'cancelled'] as const, 'planned'), statusReason: text(arc.statusReason),
      progress: typeof arc.progress === 'number' ? arc.progress : 0, owner: text(arc.owner), mode: arc.mode === 'background' ? 'background' : 'foreground',
    })),
    clocks: list<Raw>(value.clocks).filter((clock) => isObject(clock) && typeof clock.id === 'string').map((clock) => newClock({
      ...(clock as Partial<LocalCampaignRecord['clocks'][number]>),
      advanceCondition: text(clock.advanceCondition), rollbackCondition: text(clock.rollbackCondition),
      thresholds: list(clock.thresholds), history: list(clock.history),
      triggerStatus: oneOf(clock.triggerStatus, ['idle', 'deferred', 'fired'] as const, 'idle'), arcId: text(clock.arcId),
      entityIds: list(clock.entityIds), secretIds: list(clock.secretIds),
    })),
    secrets: list<Raw>(value.secrets).filter((secret) => isObject(secret) && typeof secret.id === 'string').map((secret) => newSecret({
      ...(secret as Partial<LocalCampaignRecord['secrets'][number]>),
      revealCondition: text(secret.revealCondition), entityIds: list(secret.entityIds), clockIds: list(secret.clockIds),
      recipientIds: ids(secret.recipientIds), sessionIds: list(secret.sessionIds),
      reveals: list<Raw>(secret.reveals).filter(isObject).map((reveal) => ({ ...(reveal as unknown as LocalCampaignRecord['secrets'][number]['reveals'][number]), recipientIds: ids(reveal.recipientIds) })),
    })),
    tasks: list(value.tasks),
    inbox: list(value.inbox),
    relationLayout: isObject(value.relationLayout) ? (value.relationLayout as LocalCampaignRecord['relationLayout']) : {},
    createdAt: text(value.createdAt, updatedAt),
    updatedAt,
  }
}

export function withLocalSessions(campaign: LocalCampaignRecord, sessions: LocalSessionRecord[], activeSessionId?: string): LocalCampaignRecord {
  return { ...campaign, sessionRecords: sessions, activeSessionId: activeSessionId ?? campaign.activeSessionId ?? sessions[0]?.id }
}

/** The campaign dashboard opens once the first session exists. */
export const isCampaignReady = (campaign: LocalCampaignRecord): boolean => campaign.sessionRecords.length > 0
