import type { CampaignDocument } from './campaignDocuments'
import { canAccessCampaign } from './campaignDocuments'
import { CampaignPermissionError } from './campaignRepository'
import type { DocumentData, DocumentSnapshot, StorageGateway, StorageTransaction } from './gateway'

export type CampaignContentCollection =
  | 'entities'
  | 'relations'
  | 'arcs'
  | 'lines'
  | 'goals'
  | 'events'
  | 'consequences'
  | 'clocks'
  | 'secrets'
  | 'sessions'
  | 'inbox'
  | 'tasks'
  | 'materials'
  | 'connections'
  | 'projections'
  | 'publicationQueue'
  | 'conflicts'
  | 'errors'

export interface CampaignContentDocument extends DocumentData {
  createdAt: string
  updatedAt: string
}

function safeSegment(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized || normalized.includes('/')) throw new Error(`${label} must be a non-empty path segment`)
  return normalized
}

export class CampaignContentRepository<T extends CampaignContentDocument> {
  constructor(
    private readonly storage: StorageGateway,
    private readonly collection: CampaignContentCollection,
  ) {}

  private campaignPath(campaignId: string): string {
    return `campaigns/${safeSegment(campaignId, 'Campaign id')}`
  }

  private collectionPath(campaignId: string): string {
    return `${this.campaignPath(campaignId)}/${this.collection}`
  }

  private documentPath(campaignId: string, id: string): string {
    return `${this.collectionPath(campaignId)}/${safeSegment(id, 'Document id')}`
  }

  private async assertAccess(transaction: StorageTransaction, campaignId: string, masterId: string): Promise<void> {
    const campaign = await transaction.get<CampaignDocument>(this.campaignPath(campaignId))
    if (!campaign) throw new Error(`Campaign ${campaignId} does not exist`)
    if (!canAccessCampaign(campaign.data, masterId)) {
      throw new CampaignPermissionError(`access ${this.collection} in this campaign`)
    }
  }

  async get(campaignId: string, id: string, masterId: string): Promise<DocumentSnapshot<T> | null> {
    return this.storage.runTransaction(async (transaction) => {
      await this.assertAccess(transaction, campaignId, masterId)
      return transaction.get<T>(this.documentPath(campaignId, id))
    })
  }

  async list(campaignId: string, masterId: string): Promise<DocumentSnapshot<T>[]> {
    const campaign = await this.storage.get<CampaignDocument>(this.campaignPath(campaignId))
    if (!campaign) throw new Error(`Campaign ${campaignId} does not exist`)
    if (!canAccessCampaign(campaign.data, masterId)) {
      throw new CampaignPermissionError(`access ${this.collection} in this campaign`)
    }
    return this.storage.list<T>(this.collectionPath(campaignId))
  }

  async create(
    campaignId: string,
    id: string,
    masterId: string,
    data: Omit<T, 'createdAt' | 'updatedAt'>,
    now: string,
  ): Promise<DocumentSnapshot<T>> {
    const path = this.documentPath(campaignId, id)
    await this.storage.runTransaction(async (transaction) => {
      await this.assertAccess(transaction, campaignId, masterId)
      if (await transaction.get(path)) throw new Error(`${this.collection} document ${id} already exists`)
      transaction.set(path, { ...data, createdAt: now, updatedAt: now } as T)
    })
    const created = await this.storage.get<T>(path)
    if (!created) throw new Error(`Failed to create ${path}`)
    return created
  }

  async patch(
    campaignId: string,
    id: string,
    masterId: string,
    patch: Partial<Omit<T, 'createdAt' | 'updatedAt'>>,
    now: string,
    expectedRevision?: number,
  ): Promise<DocumentSnapshot<T>> {
    const path = this.documentPath(campaignId, id)
    await this.storage.runTransaction(async (transaction) => {
      await this.assertAccess(transaction, campaignId, masterId)
      transaction.patch<T>(path, { ...patch, updatedAt: now } as Partial<T>, {
        revision: expectedRevision,
      })
    })
    const updated = await this.storage.get<T>(path)
    if (!updated) throw new Error(`Failed to patch ${path}`)
    return updated
  }

  async remove(
    campaignId: string,
    id: string,
    masterId: string,
    expectedRevision?: number,
  ): Promise<void> {
    await this.storage.runTransaction(async (transaction) => {
      await this.assertAccess(transaction, campaignId, masterId)
      transaction.remove(this.documentPath(campaignId, id), { revision: expectedRevision })
    })
  }
}
