// Actions over many library entities at once (ТЗ-2, R7) and fields from the base (R2).

import { EXPORT_FORMAT } from './catalog'
import { ENTITY_FIELDS } from './domain'
import { ROLE_OF, linkedRole, type WritableRole } from './integration'
import { enqueueByRoles } from './publishing'
import type { LocalCampaignEntity, LocalCampaignEntityType, LocalCampaignRecord, LocalRelationType, LocalSessionPlanItem } from './types'

type Patch = (entity: LocalCampaignEntity) => LocalCampaignEntity
const each = (campaign: LocalCampaignRecord, ids: string[], patch: Patch): LocalCampaignRecord =>
  ({ ...campaign, entities: campaign.entities.map((entity) => ids.includes(entity.id) ? patch(entity) : entity) })

const cleanTags = (tags: string[]) => tags.map((tag) => tag.trim().replace(/^#/, '').toLocaleLowerCase()).filter(Boolean)
export const addTags = (campaign: LocalCampaignRecord, ids: string[], tags: string[]) => each(campaign, ids, (entity) => ({ ...entity, tags: [...new Set([...entity.tags, ...cleanTags(tags)])] }))
export const removeTags = (campaign: LocalCampaignRecord, ids: string[], tags: string[]) => { const drop = cleanTags(tags); return each(campaign, ids, (entity) => ({ ...entity, tags: entity.tags.filter((tag) => !drop.includes(tag)) })) }
export const setVisibility = (campaign: LocalCampaignRecord, ids: string[], visibility: LocalCampaignEntity['visibility']) => each(campaign, ids, (entity) => ({ ...entity, visibility }))
export const setStatus = (campaign: LocalCampaignRecord, ids: string[], status: LocalCampaignEntity['status']) => each(campaign, ids, (entity) => ({ ...entity, status }))
/** A new type keeps every field value; fields the new type has no slot for travel on under their label, as imported ones do. */
export const setType = (campaign: LocalCampaignRecord, ids: string[], type: LocalCampaignEntityType) => each(campaign, ids, (entity) => {
  if (entity.type === type) return entity
  const fields: Record<string, string> = {}
  for (const [key, value] of Object.entries(entity.fields)) {
    const label = ENTITY_FIELDS[entity.type].find((field) => field.id === key)?.label ?? key
    const slot = ENTITY_FIELDS[type].find((field) => field.label.toLocaleLowerCase() === label.toLocaleLowerCase())
    fields[slot?.id ?? label] = value
  }
  const { dead: _dead, ...rest } = entity
  return { ...(type === 'npc' ? entity : rest), type, fields }
})
/** One field (by id or label) set on every chosen entity; an empty value clears it. */
export const setField = (campaign: LocalCampaignRecord, ids: string[], key: string, value: string) => each(campaign, ids, (entity) => {
  const fields = { ...entity.fields }
  if (value.trim()) fields[key] = value.trim()
  else delete fields[key]
  return { ...entity, fields }
})

/** Chosen places for every entity, then each is queued there (R3/R10). */
export function sendTo(campaign: LocalCampaignRecord, ids: string[], roles: WritableRole[] | null, now: string): LocalCampaignRecord {
  const chosen = roles ? each(campaign, ids, (entity) => ({ ...entity, destinations: roles })) : campaign
  return ids.reduce((next, id) => enqueueByRoles(next, id, now), chosen)
}

/** Library records as plan items of a session; ones already in its plan are skipped. */
export function addToPlan(campaign: LocalCampaignRecord, ids: string[], sessionId: string): LocalCampaignRecord {
  const session = campaign.sessionRecords.find((item) => item.id === sessionId)
  if (!session) return campaign
  const present = new Set(session.planItems.map((item) => item.entityId))
  const items = campaign.entities.filter((entity) => ids.includes(entity.id) && !present.has(entity.id)).map((entity): LocalSessionPlanItem => ({
    id: `plan-${crypto.randomUUID()}`, source: 'library', entityId: entity.id, text: entity.name,
    kind: entity.type === 'npc' ? 'npc' : entity.type === 'event' ? 'event' : entity.type === 'handout' || entity.type === 'map' || entity.type === 'letter' ? 'material' : 'note',
    priority: 'useful', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared',
  }))
  return { ...campaign, sessionRecords: campaign.sessionRecords.map((item) => item.id === sessionId ? { ...item, planItems: [...item.planItems, ...items] } : item) }
}

/** A relation from every chosen entity to one target; existing pairs of the same type are not doubled. */
export function relateTo(campaign: LocalCampaignRecord, ids: string[], targetId: string, type: LocalRelationType, label: string): LocalCampaignRecord {
  const exists = (fromId: string) => campaign.relations.some((relation) => relation.type === type && ((relation.fromId === fromId && relation.toId === targetId) || (relation.fromId === targetId && relation.toId === fromId)))
  const relations = ids.filter((id) => id !== targetId && !exists(id)).map((fromId) => ({ id: `relation-${crypto.randomUUID()}`, fromId, toId: targetId, label: label.trim(), type, direction: 'directed' as const, visibility: 'master' as const }))
  return { ...campaign, relations: [...campaign.relations, ...relations] }
}

/** The chosen entities with the relations between them, as a file another campaign can take in. */
export function exportEntities(campaign: LocalCampaignRecord, ids: string[], now: string): string {
  const entities = campaign.entities.filter((entity) => ids.includes(entity.id))
  const relations = campaign.relations.filter((relation) => ids.includes(relation.fromId) && ids.includes(relation.toId))
  return JSON.stringify({ format: `${EXPORT_FORMAT}#entities`, exportedAt: now, campaign: campaign.name, entities, relations }, null, 2)
}

// ─── Fields from the base (R2 C) ────────────────────────────────────────────

export interface BaseField { key: string; label: string; long: boolean; from: string }
const LONG = /опис|текст|истор|биограф|внешн|характер|заметк|цель|мотив|последств/i

/**
 * Fields the campaign's world, table and system bring for a type, beyond the
 * type's own: every label seen on records of that type from a linked source,
 * plus the system's schema when the bridge sends one.
 */
export function baseFields(campaign: LocalCampaignRecord, type: LocalCampaignEntityType, schema: Array<{ label: string; long?: boolean; from: string }> = []): BaseField[] {
  const own = new Set(ENTITY_FIELDS[type].flatMap((field) => [field.id, field.label.toLocaleLowerCase()]))
  const found = new Map<string, BaseField>()
  const add = (label: string, from: string, long?: boolean) => {
    const key = label.trim()
    if (!key || own.has(key) || own.has(key.toLocaleLowerCase()) || found.has(key.toLocaleLowerCase())) return
    found.set(key.toLocaleLowerCase(), { key, label: key, long: long ?? LONG.test(key), from })
  }
  for (const field of schema) add(field.label, field.from, field.long)
  for (const entity of campaign.entities) {
    if (entity.type !== type) continue
    for (const source of entity.sources) {
      if (!linkedRole(campaign, ROLE_OF[source.system])) continue
      for (const key of Object.keys(entity.fields)) add(key, source.system)
    }
  }
  return [...found.values()]
}
