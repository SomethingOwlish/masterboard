import type {
  LocalCampaignClock, LocalCampaignEntity, LocalCampaignEntityType, LocalCampaignRecord, LocalCampaignRelation, LocalCampaignSecret,
  LocalClockThreshold, LocalSecretStatus, LocalStoryArc,
} from './types'

// ─── Library ────────────────────────────────────────────────────────────────

/** Card fields each entity type offers in addition to the description. */
export const ENTITY_FIELDS: Record<LocalCampaignEntityType, Array<{ id: string; label: string }>> = {
  character: [{ id: 'player', label: 'Игрок' }, { id: 'concept', label: 'Концепция' }, { id: 'goal', label: 'Цель' }],
  npc: [{ id: 'role', label: 'Роль в истории' }, { id: 'motive', label: 'Мотив' }, { id: 'voice', label: 'Голос и манера' }],
  creature: [{ id: 'threat', label: 'Угроза' }, { id: 'weakness', label: 'Слабость' }],
  location: [{ id: 'mood', label: 'Атмосфера' }, { id: 'dangers', label: 'Опасности' }, { id: 'finds', label: 'Что можно найти' }],
  faction: [{ id: 'goal', label: 'Цель' }, { id: 'resources', label: 'Ресурсы' }, { id: 'leader', label: 'Лидер' }],
  rumor: [{ id: 'truth', label: 'Правда или ложь' }, { id: 'source', label: 'Источник' }],
  item: [{ id: 'properties', label: 'Свойства' }, { id: 'whereabouts', label: 'Где находится' }],
  audience: [{ id: 'who', label: 'Кто это' }, { id: 'expects', label: 'Чего ждёт' }],
  note: [],
  letter: [{ id: 'from', label: 'Отправитель' }, { id: 'to', label: 'Получатель' }],
  handout: [{ id: 'for', label: 'Для кого' }],
  map: [{ id: 'scale', label: 'Масштаб' }],
  'home-rule': [{ id: 'when', label: 'Когда применяется' }],
}

export function newEntity(input: Partial<LocalCampaignEntity> & Pick<LocalCampaignEntity, 'type' | 'name'>): LocalCampaignEntity {
  return { id: `entity-${crypto.randomUUID()}`, description: '', tags: [], visibility: 'master', status: 'active', fields: {}, origin: { kind: 'manual' }, sources: [], ...input }
}

export const ORIGIN_LABEL: Record<LocalCampaignEntity['origin']['kind'], string> = {
  manual: 'Создано вручную', plan: 'Из плана сессии', live: 'Из живой сессии', inbox: 'Из входящих', import: 'Импорт', improv: 'Из заготовок',
}

export function originLabel(entity: LocalCampaignEntity, campaign: LocalCampaignRecord): string {
  const session = entity.origin.sessionId ? campaign.sessionRecords.find((item) => item.id === entity.origin.sessionId) : undefined
  return session ? `${ORIGIN_LABEL[entity.origin.kind]} №${session.number}` : ORIGIN_LABEL[entity.origin.kind]
}

export interface EntityPlanUsage { sessionId: string; sessionNumber: number; sessionTitle: string; itemId: string; sceneTitle?: string; trashed: boolean }
export interface EntityUsages {
  plans: EntityPlanUsage[]
  relations: LocalCampaignRelation[]
  clocks: LocalCampaignClock[]
  secrets: LocalCampaignSecret[]
}

/** Everything in the campaign that points at an entity, including plans of trashed sessions. */
export function entityUsages(campaign: LocalCampaignRecord, entityId: string): EntityUsages {
  const plans = campaign.sessionRecords.flatMap((session) => session.planItems.filter((item) => item.entityId === entityId).map((item): EntityPlanUsage => {
    const scene = item.sceneId ? session.planItems.find((candidate) => candidate.id === item.sceneId) : undefined
    return { sessionId: session.id, sessionNumber: session.number, sessionTitle: session.title, itemId: item.id, sceneTitle: scene?.text || undefined, trashed: Boolean(session.deletedAt) }
  }))
  return {
    plans,
    relations: campaign.relations.filter((relation) => relation.fromId === entityId || relation.toId === entityId),
    clocks: campaign.clocks.filter((clock) => clock.entityIds.includes(entityId)),
    secrets: campaign.secrets.filter((secret) => secret.entityIds.includes(entityId)),
  }
}

export const usageCount = (usages: EntityUsages): number => usages.plans.length + usages.relations.length + usages.clocks.length + usages.secrets.length

export interface EntityFilter { query: string; type: LocalCampaignEntityType | 'all'; showArchived: boolean; /** NPCs only: alive or dead. */ fate?: 'all' | 'alive' | 'dead' }

export function filterEntities(entities: LocalCampaignEntity[], filter: EntityFilter): LocalCampaignEntity[] {
  const query = filter.query.trim().toLocaleLowerCase()
  return entities.filter((entity) =>
    (filter.showArchived || entity.status !== 'archived') &&
    (filter.type === 'all' || entity.type === filter.type) &&
    (!filter.fate || filter.fate === 'all' || (entity.type === 'npc' && Boolean(entity.dead) === (filter.fate === 'dead'))) &&
    (!query || `${entity.name} ${entity.tags.join(' ')} ${Object.values(entity.fields).join(' ')}`.toLocaleLowerCase().includes(query)))
}

// ─── Arcs ───────────────────────────────────────────────────────────────────

export function newArc(input: Partial<LocalStoryArc> = {}): LocalStoryArc {
  return { id: `arc-${crypto.randomUUID()}`, title: '', direction: '', stakes: '', status: 'planned', statusReason: '', progress: 0, owner: '', mode: 'foreground', ...input }
}

/** Paused and cancelled arcs must say why. */
export const arcNeedsReason = (status: LocalStoryArc['status']) => status === 'paused' || status === 'cancelled'

// ─── Clocks ─────────────────────────────────────────────────────────────────

export function newClock(input: Partial<LocalCampaignClock> = {}): LocalCampaignClock {
  return { id: `clock-${crypto.randomUUID()}`, title: '', kind: 'threat', value: 0, segments: 6, visibility: 'master', trigger: '', advanceCondition: '', rollbackCondition: '', thresholds: [], triggerStatus: 'idle', arcId: '', entityIds: [], secretIds: [], history: [], ...input }
}

export interface ClockMove {
  clock: LocalCampaignClock
  /** Thresholds crossed upward by this move. */
  reached: LocalClockThreshold[]
  /** The clock became full with this move and awaits confirmation. */
  filled: boolean
}

export function moveClock(clock: LocalCampaignClock, delta: number, reason: string, now: string): ClockMove | null {
  const value = Math.max(0, Math.min(clock.segments, clock.value + delta))
  if (value === clock.value || !reason.trim()) return null
  const reached = clock.thresholds.filter((threshold) => threshold.at > clock.value && threshold.at <= value && !threshold.reachedAt)
  const thresholds = clock.thresholds.map((threshold) => {
    if (reached.includes(threshold)) return { ...threshold, reachedAt: now }
    if (threshold.at > value && threshold.reachedAt) return { ...threshold, reachedAt: undefined }
    return threshold
  })
  const filled = value === clock.segments && clock.value < clock.segments
  return {
    clock: {
      ...clock, value, thresholds,
      triggerStatus: value < clock.segments ? 'idle' : clock.triggerStatus,
      firedAt: value < clock.segments ? undefined : clock.firedAt,
      history: [...clock.history, { id: `change-${crypto.randomUUID()}`, delta: value - clock.value, reason: reason.trim(), createdAt: now }],
    },
    reached,
    filled,
  }
}

export function resolveClockTrigger(clock: LocalCampaignClock, decision: 'fired' | 'deferred', now: string): LocalCampaignClock {
  if (decision === 'deferred') return { ...clock, triggerStatus: 'deferred' }
  return {
    ...clock, triggerStatus: 'fired', firedAt: now,
    history: [...clock.history, { id: `change-${crypto.randomUUID()}`, delta: 0, reason: 'Срабатывание подтверждено', note: clock.trigger, createdAt: now }],
  }
}

// ─── Secrets ────────────────────────────────────────────────────────────────

export function newSecret(input: Partial<LocalCampaignSecret> = {}): LocalCampaignSecret {
  return { id: `secret-${crypto.randomUUID()}`, title: '', truth: '', publicVersion: '', recipients: '', recipientIds: [], status: 'hidden', revealCondition: '', entityIds: [], clockIds: [], sessionIds: [], reveals: [], ...input }
}

export interface RevealInput { status: LocalSecretStatus; recipients: string; recipientIds?: string[]; sessionId?: string; note: string }

/** Applies a new status; a real change is appended to the reveal history. */
export function changeSecretStatus(secret: LocalCampaignSecret, input: RevealInput, now: string): LocalCampaignSecret {
  const recipientIds = input.recipientIds ?? secret.recipientIds
  if (input.status === secret.status && input.recipients === secret.recipients && recipientIds.join() === secret.recipientIds.join()) return secret
  const reveal = { id: `reveal-${crypto.randomUUID()}`, status: input.status, recipients: input.recipients, recipientIds, sessionId: input.sessionId || undefined, note: input.note.trim(), createdAt: now }
  const sessionIds = input.sessionId && !secret.sessionIds.includes(input.sessionId) ? [...secret.sessionIds, input.sessionId] : secret.sessionIds
  return { ...secret, status: input.status, recipients: input.recipients, recipientIds, sessionIds, reveals: [...secret.reveals, reveal] }
}

/** Sessions whose plan mentions the secret, plus sessions it was revealed in. */
export function secretSessions(secret: LocalCampaignSecret, campaign: LocalCampaignRecord) {
  return campaign.sessionRecords.filter((session) => secret.sessionIds.includes(session.id) || session.planItems.some((item) => item.secretId === secret.id))
}

export function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
}
