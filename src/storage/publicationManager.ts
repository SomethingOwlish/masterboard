import type { ExternalGateway } from '../adapters/fakeExternal'
import type { CampaignDocument } from './campaignDocuments'
import { canAccessCampaign } from './campaignDocuments'
import { CampaignPermissionError } from './campaignRepository'
import type { CapabilityPassport, PublicationQueueItem } from '../model/external'
import { confirmReady, executeBatch, previewBatch, retryFailed } from '../lib/publicationQueue'
import type { DocumentData, StorageGateway } from './gateway'

export interface StoredPublicationItem extends PublicationQueueItem, DocumentData {
  updatedAt: string
}

export interface PublicationManagerSnapshot {
  active: StoredPublicationItem[]
  history: StoredPublicationItem[]
  counts: { draft: number; ready: number; blocked: number; failed: number; succeeded: number }
}

function segment(value: string, label: string) {
  const normalized = value.trim()
  if (!normalized || normalized.includes('/')) throw new Error(`${label} must be a path segment`)
  return normalized
}

function idFromPath(path: string) {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** Persists the explicit preview → confirm → fake-send workflow in target storage. */
export class PublicationManager {
  constructor(private readonly storage: StorageGateway, private readonly gateway: ExternalGateway) {}

  private campaignPath(campaignId: string) {
    return `campaigns/${segment(campaignId, 'Campaign id')}`
  }

  private queuePath(campaignId: string) {
    return `${this.campaignPath(campaignId)}/publicationQueue`
  }

  private async requireAccess(campaignId: string, masterId: string) {
    const campaign = await this.storage.get<CampaignDocument>(this.campaignPath(campaignId))
    if (!campaign) throw new Error(`Campaign ${campaignId} does not exist`)
    if (!canAccessCampaign(campaign.data, masterId)) throw new CampaignPermissionError('manage publications in this campaign')
  }

  private async all(campaignId: string, masterId: string): Promise<StoredPublicationItem[]> {
    await this.requireAccess(campaignId, masterId)
    return (await this.storage.list<StoredPublicationItem>(this.queuePath(campaignId)))
      .map((snapshot) => ({ ...snapshot.data, id: idFromPath(snapshot.path) }))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  }

  async snapshot(campaignId: string, masterId: string): Promise<PublicationManagerSnapshot> {
    const items = await this.all(campaignId, masterId)
    const active = items.filter((item) => item.state !== 'succeeded')
    const history = items.filter((item) => item.state === 'succeeded')
    return {
      active,
      history,
      counts: {
        draft: active.filter((item) => item.state === 'draft').length,
        ready: active.filter((item) => item.state === 'ready').length,
        blocked: active.filter((item) => item.state === 'blocked').length,
        failed: active.filter((item) => item.state === 'failed').length,
        succeeded: history.length,
      },
    }
  }

  async preview(campaignId: string, masterId: string, now: string): Promise<PublicationManagerSnapshot> {
    const items = await this.all(campaignId, masterId)
    const drafts = items.filter((item) => item.state === 'draft')
    const connectionIds = [...new Set(drafts.map((item) => item.connectionId))]
    const passports: CapabilityPassport[] = []
    for (const connectionId of connectionIds) {
      try { passports.push(await this.gateway.getPassport(connectionId)) } catch { /* preview marks it unavailable */ }
    }
    const result = previewBatch(drafts, passports)
    const prepared = [...result.ready, ...result.blocked]
    await this.persist(campaignId, prepared.map((item) => ({ ...item, updatedAt: now })))
    return this.snapshot(campaignId, masterId)
  }

  async confirm(campaignId: string, masterId: string, ids: string[], now: string): Promise<PublicationManagerSnapshot> {
    const selected = new Set(ids)
    const items = await this.all(campaignId, masterId)
    const confirmed = confirmReady(items.filter((item) => selected.has(item.id)), now)
    if (confirmed.some((item) => item.state !== 'ready' || !item.confirmedAt)) {
      throw new Error('Only previewed ready operations can be confirmed')
    }
    await this.persist(campaignId, confirmed.map((item) => ({ ...item, updatedAt: now })))
    return this.snapshot(campaignId, masterId)
  }

  async execute(campaignId: string, masterId: string, now: string, manualSendConfirmed: boolean): Promise<PublicationManagerSnapshot> {
    if (!manualSendConfirmed) throw new Error('Publication requires an explicit send confirmation')
    const items = await this.all(campaignId, masterId)
    const confirmed = items.filter((item) => item.state === 'ready' && item.confirmedAt)
    if (!confirmed.length) throw new Error('There are no confirmed operations to send')
    const result = await executeBatch(confirmed, this.gateway, now)
    await this.persist(campaignId, result.items.map((item) => ({ ...item, updatedAt: now })))
    return this.snapshot(campaignId, masterId)
  }

  async retry(campaignId: string, masterId: string, ids: string[], now: string): Promise<PublicationManagerSnapshot> {
    const selected = new Set(ids)
    const items = await this.all(campaignId, masterId)
    const retried = retryFailed(items.filter((item) => selected.has(item.id)), now)
    if (!retried.length) throw new Error('Select at least one failed operation to retry')
    await this.persist(campaignId, retried.map((item) => ({ ...item, updatedAt: now })))
    return this.snapshot(campaignId, masterId)
  }

  private async persist(campaignId: string, items: StoredPublicationItem[]) {
    const queuePath = this.queuePath(campaignId)
    await this.storage.runTransaction(async (transaction) => {
      for (const item of items) {
        const path = `${queuePath}/${segment(item.id, 'Publication id')}`
        const current = await transaction.get<StoredPublicationItem>(path)
        if (!current) throw new Error(`Publication ${item.id} does not exist`)
        transaction.set<StoredPublicationItem>(path, item)
      }
    })
  }
}

