import type { ExternalGateway } from '../adapters/fakeExternal'
import { confirmReady, executeBatch, previewBatch, retryFailed } from '../lib/publicationQueue'
import type { CapabilityPassport, PublicationOperation, PublicationQueueItem } from '../model/external'
import { effectiveOperation, entityRoles, linkedRole, parseConnectionKey, patchFor, recordPublished, roleConnection, snapshotOf, sourceFor, targetTypes } from './integration'
import type { LocalCampaignRecord } from './types'

// ─── Queue operations on the campaign ───────────────────────────────────────

export const OPERATION_LABEL: Record<PublicationOperation, string> = { create: 'Создать', update: 'Обновить', archive: 'Архивировать', 'change-status': 'Сменить статус', 'change-visibility': 'Сменить видимость', 'change-tags': 'Сменить теги', 'change-name': 'Переименовать' }
export const STATE_LABEL: Record<PublicationQueueItem['state'], string> = { draft: 'Черновик', ready: 'Готово к отправке', blocked: 'Заблокировано', succeeded: 'Отправлено', failed: 'Ошибка' }

/** Queues an entity for a destination; `targetType` is the record type there (decision F3). */
export function enqueue(campaign: LocalCampaignRecord, entityId: string, connectionId: string, operation: PublicationOperation, now: string, targetType?: string): LocalCampaignRecord {
  const entity = campaign.entities.find((item) => item.id === entityId)
  if (!entity) return campaign
  const { system, externalId } = parseConnectionKey(connectionId)
  const effective = effectiveOperation(entity, system, externalId, operation)
  const linkedType = sourceFor(entity, system, externalId)?.type
  const item: PublicationQueueItem = { id: `pub-${crypto.randomUUID()}`, entityId, entityType: entity.type, connectionId, operation: effective, patch: { ...patchFor(entity, effective) }, targetType: linkedType ?? targetType, state: 'draft', createdAt: now }
  return { ...campaign, publications: [...campaign.publications, item] }
}

/** Right before sending: the current record id and the time we last saw it, so the other side can refuse a stale write (409). */
function withTargets(campaign: LocalCampaignRecord, items: PublicationQueueItem[]): PublicationQueueItem[] {
  return items.map((item) => {
    const entity = campaign.entities.find((candidate) => candidate.id === item.entityId)
    if (!entity) return item
    const { system, externalId } = parseConnectionKey(item.connectionId)
    const source = sourceFor(entity, system, externalId)
    const operation = effectiveOperation(entity, system, externalId, item.operation)
    return { ...item, operation, targetType: source?.type ?? item.targetType, target: source ? { entityId: source.id, expectedUpdatedAt: source.updatedAt } : undefined }
  })
}

const merge = (campaign: LocalCampaignRecord, changed: PublicationQueueItem[]): LocalCampaignRecord => {
  const byId = new Map(changed.map((item) => [item.id, item]))
  return { ...campaign, publications: campaign.publications.map((item) => byId.get(item.id) ?? item) }
}

/** Checks every draft against its destination's capability passport (by the type on the other side). */
export async function previewDrafts(campaign: LocalCampaignRecord, gateway: ExternalGateway): Promise<LocalCampaignRecord> {
  const drafts = campaign.publications.filter((item) => item.state === 'draft' || item.state === 'blocked').map((item) => ({ ...item, state: 'draft' as const, error: undefined }))
  const passports: CapabilityPassport[] = []
  for (const connectionId of new Set(drafts.map((item) => item.connectionId))) {
    try { passports.push(await gateway.getPassport(connectionId)) } catch { /* marked unavailable by previewBatch */ }
  }
  // The passport speaks in the destination's types; check each draft by its target type.
  const result = previewBatch(drafts.map((item) => ({ ...item, entityType: item.targetType ?? item.entityType })), passports)
  const back = (item: PublicationQueueItem) => ({ ...item, entityType: campaign.publications.find((original) => original.id === item.id)?.entityType ?? item.entityType })
  return merge(campaign, [...result.ready, ...result.blocked].map(back))
}

export function confirmSelected(campaign: LocalCampaignRecord, ids: string[], now: string): LocalCampaignRecord {
  const selected = new Set(ids)
  return merge(campaign, confirmReady(campaign.publications.filter((item) => selected.has(item.id) && item.state === 'ready'), now))
}

export async function sendConfirmed(campaign: LocalCampaignRecord, gateway: ExternalGateway, now: string): Promise<{ campaign: LocalCampaignRecord; succeeded: number; failed: number }> {
  const confirmed = campaign.publications.filter((item) => item.state === 'ready' && item.confirmedAt)
  if (!confirmed.length) throw new Error('Нет подтверждённых операций')
  const result = await executeBatch(withTargets(campaign, confirmed), gateway, now)
  return { campaign: recordPublished(merge(campaign, result.items), result.items, now), succeeded: result.succeeded, failed: result.failed }
}

export function retrySelected(campaign: LocalCampaignRecord, ids: string[], now: string): LocalCampaignRecord {
  const selected = new Set(ids)
  return merge(campaign, retryFailed(campaign.publications.filter((item) => selected.has(item.id)), now))
}

/** The shared queue logic reports reasons in English; show them in Russian. */
export function reasonLabel(error?: string): string {
  if (!error) return ''
  if (error === 'Entity type is not exposed by this connection') return 'Это назначение не принимает такой тип сущности'
  if (error === 'Capability passport is unavailable') return 'Не удалось узнать возможности назначения'
  if (error.startsWith('Operation ')) return 'Назначение не поддерживает эту операцию'
  if (error.includes('changed field')) return 'Нечего отправлять: нет изменённых полей'
  return error
}

/**
 * Puts the entity into the queue for every place it lives (ТЗ-2, R3): its own
 * choice or the type's rule, among the campaign's linked world and table.
 * An unsent draft for the same place is replaced, so saving twice queues once.
 * A place that takes no records of this type (КК9 and a letter) is skipped.
 */
export function enqueueByRoles(campaign: LocalCampaignRecord, entityId: string, now: string): LocalCampaignRecord {
  const entity = campaign.entities.find((item) => item.id === entityId)
  if (!entity) return campaign
  let next = campaign
  for (const role of entityRoles(campaign, entity)) {
    const linked = linkedRole(campaign, role)
    if (!linked) continue
    const connectionId = roleConnection(linked.system, linked.link)
    const known = sourceFor(entity, linked.system, parseConnectionKey(connectionId).externalId)
    const type = targetTypes(undefined, linked.system, entity.type)[0]?.id
    if (!known && !type) continue
    next = { ...next, publications: next.publications.filter((item) => !(item.entityId === entityId && item.connectionId === connectionId && (item.state === 'draft' || item.state === 'blocked'))) }
    next = enqueue(next, entityId, connectionId, 'update', now, type)
  }
  return next
}

/** Entities that differ from what their places last got, or were never sent there: the batch «по правилам». */
export function pendingByRoles(campaign: LocalCampaignRecord): string[] {
  const queued = new Set(campaign.publications.filter((item) => item.state !== 'succeeded').map((item) => `${item.entityId}|${item.connectionId}`))
  return campaign.entities.filter((entity) => entity.status !== 'archived' && entityRoles(campaign, entity).some((role) => {
    const linked = linkedRole(campaign, role)!
    const connectionId = roleConnection(linked.system, linked.link)
    if (queued.has(`${entity.id}|${connectionId}`)) return false
    const source = sourceFor(entity, linked.system, parseConnectionKey(connectionId).externalId)
    if (!source) return Boolean(targetTypes(undefined, linked.system, entity.type)[0])
    return JSON.stringify(source.snapshot) !== JSON.stringify(snapshotOf(entity))
  })).map((entity) => entity.id)
}
