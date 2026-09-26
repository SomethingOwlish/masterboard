import { FakeExternalGateway, type ExternalGateway } from '../adapters/fakeExternal'
import { confirmReady, executeBatch, previewBatch, retryFailed } from '../lib/publicationQueue'
import type { CapabilityPassport, ExternalConnection, PublicationOperation, PublicationQueueItem } from '../model/external'
import { ENTITY_FIELDS } from './domain'
import type { LocalCampaignEntity, LocalCampaignRecord } from './types'

// ─── Fake destinations (decision: batch manager before integrations) ────────

const FETCHED_AT = '2026-09-26T00:00:00.000Z'

export const FAKE_CONNECTIONS: ExternalConnection[] = [
  { id: 'fake-lorebook', system: 'lorebook', scope: 'world', externalId: 'lorebook-demo', label: 'Лорбук мира (тест)', state: 'active' },
  { id: 'fake-lovegame', system: 'lovegame', scope: 'campaign', externalId: 'lovegame-demo', label: 'Сайт кампании для игроков (тест)', state: 'active' },
  { id: 'fake-systemsetup', system: 'systemsetup', scope: 'system', externalId: 'systemsetup-demo', label: 'Настройки системы (тест)', state: 'active' },
]

export const FAKE_PASSPORTS: CapabilityPassport[] = [
  { connectionId: 'fake-lorebook', fetchedAt: FETCHED_AT, entities: [
    { entityType: 'npc', label: 'Персонаж', enabled: true, operations: ['create', 'update', 'archive', 'change-visibility'] },
    { entityType: 'location', label: 'Локация', enabled: true, operations: ['create', 'update', 'archive'] },
    { entityType: 'faction', label: 'Фракция', enabled: true, operations: ['create', 'update'] },
    { entityType: 'item', label: 'Предмет', enabled: false, operations: [], unavailableReason: 'Лорбук пока не принимает предметы' },
  ] },
  { connectionId: 'fake-lovegame', fetchedAt: FETCHED_AT, entities: [
    { entityType: 'character', label: 'Персонаж игрока', enabled: true, operations: ['create', 'update'] },
    { entityType: 'handout', label: 'Раздатка', enabled: true, operations: ['create', 'update', 'change-visibility'] },
    { entityType: 'letter', label: 'Письмо', enabled: true, operations: ['create'] },
    { entityType: 'map', label: 'Карта', enabled: true, operations: ['create', 'update'] },
  ] },
  { connectionId: 'fake-systemsetup', fetchedAt: FETCHED_AT, entities: [
    { entityType: 'home-rule', label: 'Домашнее правило', enabled: true, operations: ['create', 'update'] },
  ] },
]

/** A gateway that never touches the network; `failing` connections simulate an outage. */
export function fakeGateway(items: PublicationQueueItem[], failing: ReadonlySet<string> = new Set()): ExternalGateway {
  const failIds = new Set(items.filter((item) => failing.has(item.connectionId)).map((item) => item.id))
  return new FakeExternalGateway(FAKE_CONNECTIONS, FAKE_PASSPORTS, failIds)
}

// ─── Queue operations on the campaign ───────────────────────────────────────

export const OPERATION_LABEL: Record<PublicationOperation, string> = { create: 'Создать', update: 'Обновить', archive: 'Архивировать', 'change-status': 'Сменить статус', 'change-visibility': 'Сменить видимость', 'change-tags': 'Сменить теги', 'change-name': 'Переименовать' }
export const STATE_LABEL: Record<PublicationQueueItem['state'], string> = { draft: 'Черновик', ready: 'Готово к отправке', blocked: 'Заблокировано', succeeded: 'Отправлено', failed: 'Ошибка' }

/** Fields sent for an entity: only what players or the destination may see. */
export function entityPatch(entity: LocalCampaignEntity, operation: PublicationOperation): Record<string, unknown> {
  if (operation === 'archive') return { status: 'archived' }
  if (operation === 'change-visibility') return { visibility: entity.visibility }
  const fields = Object.fromEntries(ENTITY_FIELDS[entity.type].filter((field) => entity.fields[field.id]).map((field) => [field.id, entity.fields[field.id]]))
  return { name: entity.name, description: entity.description, tags: entity.tags, ...fields }
}

export function enqueue(campaign: LocalCampaignRecord, entityId: string, connectionId: string, operation: PublicationOperation, now: string): LocalCampaignRecord {
  const entity = campaign.entities.find((item) => item.id === entityId)
  if (!entity) return campaign
  const item: PublicationQueueItem = { id: `pub-${crypto.randomUUID()}`, entityId, entityType: entity.type, connectionId, operation, patch: entityPatch(entity, operation), state: 'draft', createdAt: now }
  return { ...campaign, publications: [...campaign.publications, item] }
}

const merge = (campaign: LocalCampaignRecord, changed: PublicationQueueItem[]): LocalCampaignRecord => {
  const byId = new Map(changed.map((item) => [item.id, item]))
  return { ...campaign, publications: campaign.publications.map((item) => byId.get(item.id) ?? item) }
}

/** Checks every draft against its destination's capability passport. */
export async function previewDrafts(campaign: LocalCampaignRecord, gateway: ExternalGateway): Promise<LocalCampaignRecord> {
  const drafts = campaign.publications.filter((item) => item.state === 'draft' || item.state === 'blocked').map((item) => ({ ...item, state: 'draft' as const, error: undefined }))
  const passports: CapabilityPassport[] = []
  for (const connectionId of new Set(drafts.map((item) => item.connectionId))) {
    try { passports.push(await gateway.getPassport(connectionId)) } catch { /* marked unavailable by previewBatch */ }
  }
  const result = previewBatch(drafts, passports)
  return merge(campaign, [...result.ready, ...result.blocked])
}

export function confirmSelected(campaign: LocalCampaignRecord, ids: string[], now: string): LocalCampaignRecord {
  const selected = new Set(ids)
  return merge(campaign, confirmReady(campaign.publications.filter((item) => selected.has(item.id) && item.state === 'ready'), now))
}

export async function sendConfirmed(campaign: LocalCampaignRecord, gateway: ExternalGateway, now: string): Promise<{ campaign: LocalCampaignRecord; succeeded: number; failed: number }> {
  const confirmed = campaign.publications.filter((item) => item.state === 'ready' && item.confirmedAt)
  if (!confirmed.length) throw new Error('Нет подтверждённых операций')
  const result = await executeBatch(confirmed, gateway, now)
  return { campaign: merge(campaign, result.items), succeeded: result.succeeded, failed: result.failed }
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
  if (error.startsWith('Configured fake failure')) return 'Назначение не ответило (имитация сбоя)'
  if (error.includes('changed field')) return 'Нечего отправлять: нет изменённых полей'
  return error
}
