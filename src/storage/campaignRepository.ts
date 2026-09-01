import type { CampaignDocument, CampaignMode } from './campaignDocuments'
import { canAccessCampaign, canManageCampaign } from './campaignDocuments'
import type { DocumentSnapshot, StorageGateway } from './gateway'

export interface CreateCampaignDocumentInput {
  id: string
  name: string
  idea?: string
  mode: CampaignMode
  ownerId: string
  coMasterId?: string
  now: string
}

export class CampaignPermissionError extends Error {
  constructor(action: string) {
    super(`Master is not allowed to ${action}`)
    this.name = 'CampaignPermissionError'
  }
}

export class CampaignRepository {
  constructor(private readonly storage: StorageGateway) {}

  private path(id: string): string {
    return `campaigns/${id}`
  }

  async create(input: CreateCampaignDocumentInput): Promise<DocumentSnapshot<CampaignDocument>> {
    const name = input.name.trim()
    if (!name) throw new Error('Campaign name is required')
    if (!input.ownerId.trim()) throw new Error('Campaign owner is required')
    if (input.coMasterId === input.ownerId) throw new Error('Owner cannot also be the co-master')
    if (await this.storage.get(this.path(input.id))) throw new Error(`Campaign ${input.id} already exists`)
    return this.storage.set(this.path(input.id), {
      name,
      idea: input.idea?.trim() || undefined,
      mode: input.mode,
      ownerId: input.ownerId,
      coMasterId: input.coMasterId,
      createdAt: input.now,
      updatedAt: input.now,
    })
  }

  async getForMaster(id: string, masterId: string): Promise<DocumentSnapshot<CampaignDocument> | null> {
    const campaign = await this.storage.get<CampaignDocument>(this.path(id))
    if (!campaign) return null
    if (!canAccessCampaign(campaign.data, masterId)) throw new CampaignPermissionError('open this campaign')
    return campaign
  }

  async listForMaster(masterId: string): Promise<DocumentSnapshot<CampaignDocument>[]> {
    const campaigns = await this.storage.list<CampaignDocument>('campaigns')
    return campaigns.filter((campaign) => canAccessCampaign(campaign.data, masterId))
  }

  async updateDetails(
    id: string,
    masterId: string,
    patch: Pick<Partial<CampaignDocument>, 'name' | 'idea' | 'mode' | 'activeTime'>,
    now: string,
  ): Promise<DocumentSnapshot<CampaignDocument>> {
    const current = await this.getForMaster(id, masterId)
    if (!current) throw new Error(`Campaign ${id} does not exist`)
    if (patch.name !== undefined && !patch.name.trim()) throw new Error('Campaign name is required')
    return this.storage.patch<CampaignDocument>(this.path(id), {
      ...patch,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.idea !== undefined ? { idea: patch.idea.trim() || undefined } : {}),
      updatedAt: now,
    }, { revision: current.revision })
  }

  async replaceCoMaster(
    id: string,
    ownerId: string,
    coMasterId: string | undefined,
    now: string,
  ): Promise<DocumentSnapshot<CampaignDocument>> {
    const current = await this.storage.get<CampaignDocument>(this.path(id))
    if (!current) throw new Error(`Campaign ${id} does not exist`)
    if (!canManageCampaign(current.data, ownerId)) throw new CampaignPermissionError('replace the co-master')
    if (coMasterId === ownerId) throw new Error('Owner cannot also be the co-master')
    return this.storage.patch<CampaignDocument>(this.path(id), {
      coMasterId,
      updatedAt: now,
    }, { revision: current.revision })
  }
}
