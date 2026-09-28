import type { LocalSessionFlow, LocalSessionPlanItem, LocalSessionRecord } from './types'

type Priority = LocalSessionPlanItem['priority']
type UseStatus = LocalSessionPlanItem['status']

/**
 * Sets an item's status. Playing one member of an "or" group marks the other
 * still-open members of that group as skipped.
 */
export function setItemStatus(session: LocalSessionRecord, itemId: string, status: UseStatus): LocalSessionRecord {
  const target = session.planItems.find((item) => item.id === itemId)
  if (!target) return session
  const group = target.alternative.trim()
  return {
    ...session,
    planItems: session.planItems.map((item) => {
      if (item.id === itemId) return { ...item, status }
      if (status === 'used' && group && item.alternative.trim() === group && (item.status === 'prepared' || item.status === 'current')) return { ...item, status: 'skipped' }
      return item
    }),
  }
}

export interface MoveTarget {
  /** Put the item in front of this item (and take its priority and scene). */
  beforeId?: string
  /** Move to the end of this priority column. */
  priority?: Priority
  /** Attach to a scene, or detach with `null`. */
  sceneId?: string | null
  /** Reorder only: keep the item's own priority when placed before another item (the scene tree). */
  keepPriority?: boolean
}

/** Drag-and-drop move inside the plan: reorder, change priority or scene. */
export function moveItemTo(session: LocalSessionRecord, itemId: string, target: MoveTarget): LocalSessionRecord {
  const item = session.planItems.find((entry) => entry.id === itemId)
  if (!item || target.beforeId === itemId) return session
  const rest = session.planItems.filter((entry) => entry.id !== itemId)
  const before = target.beforeId ? rest.find((entry) => entry.id === target.beforeId) : undefined
  const moved: LocalSessionPlanItem = {
    ...item,
    priority: target.keepPriority ? target.priority ?? item.priority : before?.priority ?? target.priority ?? item.priority,
    sceneId: target.sceneId === null ? undefined : target.sceneId ?? (before ? before.sceneId : item.sceneId),
  }
  if (moved.sceneId === moved.id || (moved.kind === 'scene' && moved.sceneId)) moved.sceneId = undefined
  // Changing only the scene keeps the item where it is in the plan order.
  if (!target.beforeId && !target.priority) return { ...session, planItems: session.planItems.map((entry) => entry.id === itemId ? moved : entry) }
  const index = before ? rest.indexOf(before) : rest.length
  return { ...session, planItems: [...rest.slice(0, index), moved, ...rest.slice(index)] }
}

/**
 * Moves an item one step up or down among its peers only — scenes among
 * scenes, items among the items of the same scene — skipping everything else.
 */
export function shiftAmongPeers(session: LocalSessionRecord, itemId: string, delta: -1 | 1): LocalSessionRecord {
  const item = session.planItems.find((entry) => entry.id === itemId)
  if (!item) return session
  const ids = new Set(session.planItems.map((entry) => entry.id))
  const sceneOf = (entry: LocalSessionPlanItem) => entry.kind === 'scene' ? 'scene' : entry.sceneId && ids.has(entry.sceneId) ? entry.sceneId : ''
  const peers = session.planItems.filter((entry) => sceneOf(entry) === sceneOf(item))
  const neighbour = peers[peers.indexOf(item) + delta]
  if (!neighbour) return session
  const rest = session.planItems.filter((entry) => entry.id !== itemId)
  const index = rest.indexOf(neighbour) + (delta > 0 ? 1 : 0)
  return { ...session, planItems: [...rest.slice(0, index), item, ...rest.slice(index)] }
}

export function alternativeGroups(session: LocalSessionRecord): string[] {
  return [...new Set(session.planItems.map((item) => item.alternative.trim()).filter(Boolean))]
}

export function addFlow(session: LocalSessionRecord, fromItemId: string, toItemId: string, condition: string): LocalSessionRecord {
  if (fromItemId === toItemId || session.flows.some((flow) => flow.fromItemId === fromItemId && flow.toItemId === toItemId)) return session
  const flow: LocalSessionFlow = { id: `flow-${crypto.randomUUID()}`, fromItemId, toItemId, condition: condition.trim() }
  return { ...session, flows: [...session.flows, flow] }
}

/** Removes an item together with its transitions and scene membership. */
export function removeItem(session: LocalSessionRecord, itemId: string): LocalSessionRecord {
  return {
    ...session,
    planItems: session.planItems.filter((item) => item.id !== itemId).map((item) => item.sceneId === itemId ? { ...item, sceneId: undefined } : item),
    flows: session.flows.filter((flow) => flow.fromItemId !== itemId && flow.toItemId !== itemId),
  }
}

export type TimelineStep =
  | { kind: 'single'; item: LocalSessionPlanItem; children: LocalSessionPlanItem[] }
  | { kind: 'fork'; group: string; branches: Array<{ item: LocalSessionPlanItem; children: LocalSessionPlanItem[] }> }

/**
 * Orders the session for the timeline: top-level items in plan order, with
 * scene members nested under their scene and "or" groups shown as forks.
 */
export function timeline(session: LocalSessionRecord): TimelineStep[] {
  const ids = new Set(session.planItems.map((item) => item.id))
  const childrenOf = (id: string) => session.planItems.filter((item) => item.sceneId === id)
  const topLevel = session.planItems.filter((item) => !item.sceneId || !ids.has(item.sceneId))
  const steps: TimelineStep[] = []
  const seenGroups = new Set<string>()
  for (const item of topLevel) {
    const group = item.alternative.trim()
    if (!group) { steps.push({ kind: 'single', item, children: childrenOf(item.id) }); continue }
    if (seenGroups.has(group)) continue
    seenGroups.add(group)
    steps.push({ kind: 'fork', group, branches: topLevel.filter((entry) => entry.alternative.trim() === group).map((entry) => ({ item: entry, children: childrenOf(entry.id) })) })
  }
  return steps
}

/** What the timeline shows (ТЗ-2, R8; ТЗ-3, этап 6): by default scenes, events, goals and consequences, and the journal without automatic lines. */
export interface TimelineOptions { others: boolean; dropped: boolean; journal: boolean; automatic: boolean }
export const TIMELINE_DEFAULT: TimelineOptions = { others: false, dropped: false, journal: true, automatic: false }
const EVENT_KINDS = new Set<LocalSessionPlanItem['kind']>(['scene', 'event', 'goal', 'consequence'])
const DROPPED = new Set<LocalSessionPlanItem['status']>(['skipped', 'cancelled', 'moved'])
/** Journal lines written by the app itself: clock moves and «Появилось: …». */
export const AUTOMATIC_LOG = new Set(['clock', 'entity'])

export function filterTimeline(steps: TimelineStep[], options: TimelineOptions): TimelineStep[] {
  const keep = (item: LocalSessionPlanItem) => (options.others || EVENT_KINDS.has(item.kind)) && (options.dropped || !DROPPED.has(item.status))
  const branch = (entry: { item: LocalSessionPlanItem; children: LocalSessionPlanItem[] }) => keep(entry.item) ? [{ item: entry.item, children: entry.children.filter(keep) }] : []
  return steps.flatMap((step): TimelineStep[] => {
    if (step.kind === 'single') return branch(step).map((entry) => ({ kind: 'single', ...entry }))
    const branches = step.branches.flatMap(branch)
    return branches.length ? [{ kind: 'fork', group: step.group, branches }] : []
  })
}
