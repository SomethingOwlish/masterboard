import type { ExternalSystem } from '../model/external'
import type {
  LocalCampaignClock, LocalCampaignEntity, LocalCampaignEntityType, LocalCampaignRecord, LocalCampaignRelation, LocalCampaignSecret,
  LocalClockThreshold, LocalSecretStatus, LocalStoryArc,
} from './types'
import { ORIGIN_LABEL } from './labels'

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
  event: [{ id: 'when', label: 'Когда в мире' }, { id: 'where', label: 'Где' }, { id: 'who', label: 'Участники' }, { id: 'consequences', label: 'Последствия' }],
  lore: [{ id: 'section', label: 'Раздел' }, { id: 'text', label: 'Текст' }],
}

/**
 * The same record under another type. Field values are kept: one whose label the
 * new type also has moves into that slot, the rest travel on under their label,
 * as imported fields do. «Погиб» belongs to NPCs only.
 */
export function retypeEntity<T extends Pick<LocalCampaignEntity, 'type' | 'fields' | 'dead'>>(entity: T, type: LocalCampaignEntityType): T {
  if (entity.type === type) return entity
  const fields: Record<string, string> = {}
  for (const [key, value] of Object.entries(entity.fields)) {
    const label = ENTITY_FIELDS[entity.type].find((field) => field.id === key)?.label ?? key
    const slot = ENTITY_FIELDS[type].find((field) => field.label.toLocaleLowerCase() === label.toLocaleLowerCase())
    fields[slot?.id ?? label] = value
  }
  const { dead: _dead, ...rest } = entity
  return { ...(type === 'npc' ? entity : rest), type, fields } as T
}

export function newEntity(input: Partial<LocalCampaignEntity> & Pick<LocalCampaignEntity, 'type' | 'name'>): LocalCampaignEntity {
  return { id: `entity-${crypto.randomUUID()}`, description: '', tags: [], visibility: 'master', status: 'active', fields: {}, origin: { kind: 'manual' }, sources: [], ...input }
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

/** Plans of live sessions: these keep an entity from being deleted. Trashed sessions do not. */
export const blockingPlans = (usages: EntityUsages): EntityPlanUsage[] => usages.plans.filter((usage) => !usage.trashed)

/**
 * Deletes an entity and every reference to it: relations, clocks, secrets,
 * players' characters and not yet sent publications. Plan items in trashed
 * sessions become plain text under its name, so a restored session has no
 * dangling link. Live plans must be cleared first (see `blockingPlans`).
 */
export function removeEntity(campaign: LocalCampaignRecord, id: string): LocalCampaignRecord {
  const entity = campaign.entities.find((item) => item.id === id)
  if (!entity) return campaign
  return {
    ...campaign,
    entities: campaign.entities.filter((item) => item.id !== id),
    relations: campaign.relations.filter((relation) => relation.fromId !== id && relation.toId !== id),
    clocks: campaign.clocks.map((clock) => ({ ...clock, entityIds: clock.entityIds.filter((item) => item !== id) })),
    secrets: campaign.secrets.map((secret) => ({ ...secret, entityIds: secret.entityIds.filter((item) => item !== id) })),
    players: campaign.players.map((player) => ({ ...player, characterIds: player.characterIds.filter((item) => item !== id) })),
    publications: campaign.publications.filter((item) => item.entityId !== id || item.state === 'succeeded'),
    sessionRecords: campaign.sessionRecords.map((session) => !session.deletedAt || !session.planItems.some((item) => item.entityId === id) ? session : {
      ...session,
      planItems: session.planItems.map((item) => {
        if (item.entityId !== id) return item
        const { entityId: _entityId, ...rest } = item
        return { ...rest, source: 'text' as const, text: item.text || entity.name }
      }),
    }),
  }
}

export const usageCount = (usages: EntityUsages): number => usages.plans.length + usages.relations.length + usages.clocks.length + usages.secrets.length

export type EntitySort = 'name' | 'type' | 'used' | 'added'
export interface EntityFilter {
  query: string
  type: LocalCampaignEntityType | 'all'
  showArchived: boolean
  /** NPCs only: alive or dead. */
  fate?: 'all' | 'alive' | 'dead'
  /** Every tag must be on the entity (ТЗ-2, R5). */
  tags?: string[]
  visibility?: 'all' | 'master' | 'public'
  status?: 'all' | 'active' | 'inactive'
  /** Where it came from or went to: a system, or `none` — only in Masterboard. */
  source?: 'all' | 'none' | ExternalSystem
  /** Records still missing something after an import (ТЗ-2, R6). */
  missing?: 'tags' | 'description'
  /** Only records that came in by import. */
  imported?: boolean
  sort?: EntitySort
}
export const EMPTY_FILTER: EntityFilter = { query: '', type: 'all', showArchived: false, fate: 'all', tags: [], visibility: 'all', status: 'all', source: 'all', sort: 'added' }

/** How many narrowing conditions are on, apart from the query and the type. */
export const activeFilterCount = (filter: EntityFilter) =>
  (filter.tags?.length ?? 0) + (filter.visibility && filter.visibility !== 'all' ? 1 : 0) + (filter.status && filter.status !== 'all' ? 1 : 0) + (filter.source && filter.source !== 'all' ? 1 : 0) + (filter.fate && filter.fate !== 'all' ? 1 : 0) + (filter.showArchived ? 1 : 0) + (filter.missing ? 1 : 0) + (filter.imported ? 1 : 0)

const norm = (value: string) => value.toLocaleLowerCase().replace(/ё/g, 'е')

/** Library filter: every word of the query anywhere in the record (name, description, tags, fields), plus the chosen conditions. */
export function filterEntities(entities: LocalCampaignEntity[], filter: EntityFilter, usage?: (entity: LocalCampaignEntity) => number): LocalCampaignEntity[] {
  const words = norm(filter.query.trim()).split(/\s+/).filter(Boolean)
  const found = entities.filter((entity) =>
    (filter.showArchived || entity.status !== 'archived') &&
    (filter.type === 'all' || entity.type === filter.type) &&
    (!filter.fate || filter.fate === 'all' || (entity.type === 'npc' && Boolean(entity.dead) === (filter.fate === 'dead'))) &&
    (!filter.tags?.length || filter.tags.every((tag) => entity.tags.includes(tag))) &&
    (!filter.visibility || filter.visibility === 'all' || entity.visibility === filter.visibility) &&
    (!filter.status || filter.status === 'all' || entity.status === filter.status) &&
    (!filter.missing || (filter.missing === 'tags' ? !entity.tags.length : !entity.description.trim())) &&
    (!filter.imported || entity.origin.kind === 'import') &&
    (!filter.source || filter.source === 'all' || (filter.source === 'none' ? !entity.sources.length : entity.sources.some((source) => source.system === filter.source))) &&
    (!words.length || words.every((word) => norm(`${entity.name} ${entity.description} ${entity.tags.join(' ')} ${Object.values(entity.fields).join(' ')}`).includes(word))))
  const sort = filter.sort ?? 'added'
  if (sort === 'name') return [...found].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  if (sort === 'type') return [...found].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, 'ru'))
  if (sort === 'used' && usage) return [...found].sort((a, b) => usage(b) - usage(a) || a.name.localeCompare(b.name, 'ru'))
  return found
}

/** A named set of library filters, personal to a master (ТЗ-2, R5 D). */
export interface SavedFilter { id: string; name: string; filter: EntityFilter }

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


