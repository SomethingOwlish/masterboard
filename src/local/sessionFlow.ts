import { newEntity } from './domain'
import { blankSession } from './normalize'
import type {
  LocalCampaignEntity, LocalCampaignEntityType, LocalCampaignRecord, LocalCampaignRelation, LocalCampaignTask, LocalLogKind, LocalRelationType,
  LocalReviewDecision, LocalSessionLogEntry, LocalSessionPlanItem, LocalSessionPlanKind, LocalSessionRecord, LocalTaskOrigin,
} from './types'

// ─── Relations ──────────────────────────────────────────────────────────────

export interface RelationFilter { visibility: 'all' | 'master' | 'public'; type: LocalRelationType | 'all'; entityId: string }

export function filterRelations(relations: LocalCampaignRelation[], filter: RelationFilter): LocalCampaignRelation[] {
  return relations.filter((relation) =>
    (filter.visibility === 'all' || relation.visibility === filter.visibility) &&
    (filter.type === 'all' || relation.type === filter.type) &&
    (!filter.entityId || relation.fromId === filter.entityId || relation.toId === filter.entityId))
}

/**
 * Entities a relation view can show: every active one, plus archived ones that
 * `ids` still point at (ends of shown relations, the relation being edited), so
 * such a relation is never dropped silently.
 */
export function relationEntities(campaign: LocalCampaignRecord, ids: Iterable<string>): LocalCampaignEntity[] {
  const kept = new Set(ids)
  return campaign.entities.filter((entity) => entity.status !== 'archived' || kept.has(entity.id))
}

// ─── Live log ───────────────────────────────────────────────────────────────

export function logEntry(kind: LocalLogKind, text: string, now: string, refs: Pick<LocalSessionLogEntry, 'clockId' | 'secretId' | 'entityId'> = {}): LocalSessionLogEntry {
  return { id: `log-${crypto.randomUUID()}`, text: text.trim(), kind, createdAt: now, ...refs }
}

export function newTask(text: string, source: LocalCampaignTask['source'], origin?: LocalTaskOrigin): LocalCampaignTask {
  return { id: `task-${crypto.randomUUID()}`, text: text.trim(), source, done: false, origin }
}

export function taskOriginLabel(task: LocalCampaignTask, campaign: LocalCampaignRecord): string {
  const session = task.origin?.sessionId ? campaign.sessionRecords.find((item) => item.id === task.origin?.sessionId) : undefined
  const clock = task.origin?.clockId ? campaign.clocks.find((item) => item.id === task.origin?.clockId) : undefined
  const entity = task.origin?.entityId ? campaign.entities.find((item) => item.id === task.origin?.entityId) : undefined
  if (task.source === 'session' && session) return `Из сессии №${session.number}`
  if (task.source === 'review' && session) return `Из разбора сессии №${session.number}`
  if (task.source === 'clock') return clock ? `Часы «${clock.title}»` : 'Последствие часов'
  if (task.source === 'inbox') return 'Из входящих'
  if (task.source === 'preparation') return entity ? `Подготовка: ${entity.name}` : 'Подготовка'
  return entity ? `Про «${entity.name}»` : 'Masterboard'
}

// ─── Review ─────────────────────────────────────────────────────────────────

/**
 * Required and desired items that were not played and need a GM decision. Items a
 * decision was already taken on stay in the list after it is applied (a cancelled
 * item becomes `cancelled`), so a reopened review can still change them.
 */
export function reviewItems(session: LocalSessionRecord): LocalSessionPlanItem[] {
  return session.planItems.filter((item) => (item.priority === 'required' || item.priority === 'desired')
    && (Boolean(session.reviewDecisions[item.id] || session.appliedDecisions[item.id]) || (item.status !== 'used' && item.status !== 'cancelled')))
}

export function missingDecisions(session: LocalSessionRecord): LocalSessionPlanItem[] {
  return reviewItems(session).filter((item) => !session.reviewDecisions[item.id])
}

const LIBRARY_TYPE: Partial<Record<LocalSessionPlanKind, LocalCampaignEntityType>> = { npc: 'npc', material: 'handout' }

export interface ApplyReviewOptions {
  /**
   * Session that receives carried items and the next-game date: an existing one,
   * `new` to create the next one, or `none` to create nothing (only when nothing is carried).
   */
  target: string | 'new' | 'none'
  now: string
}

/**
 * Applies the review decisions of one session and completes its review.
 * Decisions applied earlier are skipped, so reopening a review is safe; a carry
 * that was changed to something else takes its unplayed copy back.
 */
export function completeReview(campaign: LocalCampaignRecord, sessionId: string, options: ApplyReviewOptions): LocalCampaignRecord {
  const session = campaign.sessionRecords.find((item) => item.id === sessionId)
  if (!session) throw new Error('Сессия не найдена')
  if (missingDecisions(session).length) throw new Error('Не по всем пунктам принято решение')
  const pending = reviewItems(session).filter((item) => session.appliedDecisions[item.id] !== session.reviewDecisions[item.id])
  const carried = pending.filter((item) => session.reviewDecisions[item.id] === 'carry')
  const uncarried = new Set(pending.filter((item) => session.appliedDecisions[item.id] === 'carry').map((item) => item.id))
  if (carried.length && options.target === 'none') throw new Error('Выберите, в какую сессию перенести пункты')

  const isCopyToTakeBack = (item: LocalSessionPlanItem) => item.carriedFromSessionId === session.id && Boolean(item.carriedFromItemId && uncarried.has(item.carriedFromItemId)) && item.status === 'prepared'
  let sessions = uncarried.size
    ? campaign.sessionRecords.map((item) => item.planItems.some(isCopyToTakeBack) ? { ...item, planItems: item.planItems.filter((planItem) => !isCopyToTakeBack(planItem)) } : item)
    : campaign.sessionRecords
  let entities = campaign.entities
  let nextSessionId = session.nextSessionId
  if (options.target !== 'none') {
    const earlier = options.target === 'new' ? sessions.find((item) => item.id === session.nextSessionId && !item.deletedAt) : undefined
    let target = earlier ?? (options.target === 'new' ? undefined : sessions.find((item) => item.id === options.target))
    if (!target) {
      const number = Math.max(0, ...sessions.map((item) => item.number)) + 1
      target = { ...blankSession(number, session.masterId, options.now), title: `Сессия ${number}`, date: session.nextGame?.date ?? '', arcId: session.arcId, backgroundArcIds: session.backgroundArcIds, groupId: session.groupId, guestPlayerIds: session.guestPlayerIds, participants: session.participants }
      sessions = [...sessions, target]
    }
    const copies: LocalSessionPlanItem[] = carried.map((item) => ({ ...item, id: `plan-${crypto.randomUUID()}`, status: 'prepared', origin: 'review', carriedFromSessionId: session.id, carriedFromItemId: item.id }))
    const targetId = target.id
    // Дата следующей игры из разбора ложится в сессию-получатель, если своей у неё ещё нет.
    sessions = sessions.map((item) => item.id === targetId ? { ...item, planItems: [...item.planItems, ...copies], date: item.date || session.nextGame?.date || '' } : item)
    nextSessionId = targetId
  }

  const applied: Record<string, LocalReviewDecision> = { ...session.appliedDecisions }
  const planItems = session.planItems.map((item) => {
    const decision = pending.includes(item) ? session.reviewDecisions[item.id] : undefined
    if (!decision) return item
    applied[item.id] = decision
    if (decision === 'carry') return { ...item, status: 'moved' as const }
    if (decision === 'cancel') return { ...item, status: 'cancelled' as const }
    if (decision === 'library' && item.source === 'text' && !item.secretId) {
      const entity = newEntity({ type: LIBRARY_TYPE[item.kind] ?? 'note', name: item.text, description: item.note, origin: { kind: 'plan', sessionId: session.id } })
      entities = [...entities, entity]
      return { ...item, source: 'library' as const, entityId: entity.id, status: 'skipped' as const }
    }
    return { ...item, status: 'skipped' as const }
  })
  sessions = sessions.map((item) => item.id === session.id ? { ...item, planItems, appliedDecisions: applied, reviewStatus: 'completed' as const, nextSessionId } : item)
  return { ...campaign, entities, sessionRecords: sessions, activeSessionId: nextSessionId ?? campaign.activeSessionId }
}
