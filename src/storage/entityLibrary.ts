import type { CampaignDocument } from './campaignDocuments'
import { canAccessCampaign } from './campaignDocuments'
import { CampaignPermissionError } from './campaignRepository'
import type { CampaignContentDocument } from './campaignContentRepository'
import type { DocumentSnapshot, StorageGateway } from './gateway'

export type TargetEntityType =
  | 'character'
  | 'npc'
  | 'creature'
  | 'location'
  | 'item'
  | 'faction'
  | 'audience'
  | 'rumor'
  | 'letter'
  | 'handout'
  | 'map'
  | 'home-rule'
  | 'note'

export type EntityOrigin = 'masterboard' | 'lovegame' | 'lorebook' | 'systemsetup'

export interface TargetEntityDocument extends CampaignContentDocument {
  entityType: TargetEntityType
  name: string
  status: string
  tags: string[]
  archived: boolean
  description?: string
  sourceNoteId?: string
  [field: string]: unknown
}

interface ConnectionDocument extends CampaignContentDocument {
  system: Exclude<EntityOrigin, 'masterboard'>
  label: string
}

interface ProjectionDocument extends CampaignContentDocument {
  entityId: string
  connectionId: string
  visibility: string
  syncState: string
}

interface InboxDocument extends CampaignContentDocument {
  text: string
  state: 'unprocessed' | 'processed'
  targetType?: TargetEntityType
  resultingEntityIds?: string[]
}

export interface EntityLibraryRecord {
  id: string
  entity: TargetEntityDocument
  origins: EntityOrigin[]
  projectionCount: number
}

export interface EntityLibraryFilter {
  query?: string
  types?: TargetEntityType[]
  origin?: EntityOrigin
  includeArchived?: boolean
}

export interface ManualEntityInput {
  id: string
  entityType: TargetEntityType
  name: string
  status?: string
  tags?: string[]
  description?: string
  fields?: Record<string, unknown>
}

function segment(value: string, label: string) {
  const result = value.trim()
  if (!result || result.includes('/')) throw new Error(`${label} must be a path segment`)
  return result
}

function idFromPath(path: string) {
  return path.slice(path.lastIndexOf('/') + 1)
}

function normalizeTags(tags: string[] = []) {
  return [...new Set(tags.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean))]
}

export class EntityLibrary {
  constructor(private readonly storage: StorageGateway) {}

  private campaignPath(campaignId: string) {
    return `campaigns/${segment(campaignId, 'Campaign id')}`
  }

  private async requireCampaign(campaignId: string, masterId: string): Promise<CampaignDocument> {
    const campaign = await this.storage.get<CampaignDocument>(this.campaignPath(campaignId))
    if (!campaign) throw new Error(`Campaign ${campaignId} does not exist`)
    if (!canAccessCampaign(campaign.data, masterId)) throw new CampaignPermissionError('access this entity library')
    return campaign.data
  }

  async list(campaignId: string, masterId: string, filter: EntityLibraryFilter = {}): Promise<EntityLibraryRecord[]> {
    await this.requireCampaign(campaignId, masterId)
    const base = this.campaignPath(campaignId)
    const [entities, connections, projections] = await Promise.all([
      this.storage.list<TargetEntityDocument>(`${base}/entities`),
      this.storage.list<ConnectionDocument>(`${base}/connections`),
      this.storage.list<ProjectionDocument>(`${base}/projections`),
    ])
    const systems = new Map(connections.map((item) => [idFromPath(item.path), item.data.system]))
    const query = filter.query?.trim().toLocaleLowerCase() ?? ''
    const allowedTypes = filter.types?.length ? new Set(filter.types) : null

    return entities.map((item): EntityLibraryRecord => {
      const id = idFromPath(item.path)
      const entityProjections = projections.filter((projection) => projection.data.entityId === id)
      const origins = new Set<EntityOrigin>(['masterboard'])
      for (const projection of entityProjections) {
        const system = systems.get(projection.data.connectionId)
        if (system) origins.add(system)
      }
      return { id, entity: item.data, origins: [...origins], projectionCount: entityProjections.length }
    }).filter((record) => filter.includeArchived || !record.entity.archived)
      .filter((record) => !allowedTypes || allowedTypes.has(record.entity.entityType))
      .filter((record) => !filter.origin || record.origins.includes(filter.origin))
      .filter((record) => !query
        || record.entity.name.toLocaleLowerCase().includes(query)
        || record.entity.tags.some((tag) => tag.toLocaleLowerCase().includes(query)))
      .sort((left, right) => left.entity.name.localeCompare(right.entity.name, undefined, { sensitivity: 'base' }))
  }

  async createManual(campaignId: string, masterId: string, input: ManualEntityInput, now: string): Promise<DocumentSnapshot<TargetEntityDocument>> {
    const campaignPath = this.campaignPath(campaignId)
    const entityId = segment(input.id, 'Entity id')
    const name = input.name.trim()
    if (!name) throw new Error('Entity name is required')
    const path = `${campaignPath}/entities/${entityId}`
    await this.storage.runTransaction(async (transaction) => {
      const campaign = await transaction.get<CampaignDocument>(campaignPath)
      if (!campaign) throw new Error(`Campaign ${campaignId} does not exist`)
      if (!canAccessCampaign(campaign.data, masterId)) throw new CampaignPermissionError('create an entity in this campaign')
      if (await transaction.get(path)) throw new Error(`Entity ${entityId} already exists`)
      transaction.set<TargetEntityDocument>(path, {
        ...input.fields,
        entityType: input.entityType,
        name,
        status: input.status?.trim() || 'active',
        tags: normalizeTags(input.tags),
        archived: false,
        description: input.description?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      })
    })
    const created = await this.storage.get<TargetEntityDocument>(path)
    if (!created) throw new Error(`Failed to create ${path}`)
    return created
  }

  async convertInbox(campaignId: string, inboxId: string, masterId: string, entities: ManualEntityInput[], now: string) {
    if (entities.length === 0) throw new Error('At least one resulting entity is required')
    const campaignPath = this.campaignPath(campaignId)
    const inboxPath = `${campaignPath}/inbox/${segment(inboxId, 'Inbox id')}`
    const ids = entities.map((entity) => segment(entity.id, 'Entity id'))
    if (new Set(ids).size !== ids.length) throw new Error('Resulting entity ids must be unique')

    await this.storage.runTransaction(async (transaction) => {
      const campaign = await transaction.get<CampaignDocument>(campaignPath)
      if (!campaign) throw new Error(`Campaign ${campaignId} does not exist`)
      if (!canAccessCampaign(campaign.data, masterId)) throw new CampaignPermissionError('convert inbox notes in this campaign')
      const inbox = await transaction.get<InboxDocument>(inboxPath)
      if (!inbox) throw new Error(`Inbox item ${inboxId} does not exist`)
      if (inbox.data.state !== 'unprocessed') throw new Error(`Inbox item ${inboxId} is already processed`)

      for (let index = 0; index < entities.length; index += 1) {
        const input = entities[index]
        const name = input.name.trim()
        if (!name) throw new Error('Entity name is required')
        const path = `${campaignPath}/entities/${ids[index]}`
        if (await transaction.get(path)) throw new Error(`Entity ${ids[index]} already exists`)
        transaction.set<TargetEntityDocument>(path, {
          ...input.fields,
          entityType: input.entityType,
          name,
          status: input.status?.trim() || 'active',
          tags: normalizeTags(input.tags),
          archived: false,
          description: input.description?.trim() || inbox.data.text,
          sourceNoteId: inboxId,
          createdAt: now,
          updatedAt: now,
        })
      }
      transaction.patch<InboxDocument>(inboxPath, {
        state: 'processed', resultingEntityIds: ids, updatedAt: now,
      }, { revision: inbox.revision })
    })

    return Promise.all(ids.map((id) => this.storage.get<TargetEntityDocument>(`${campaignPath}/entities/${id}`)))
  }

  async setArchived(campaignId: string, masterId: string, ids: string[], archived: boolean, now: string): Promise<void> {
    if (!ids.length) throw new Error('Select at least one entity')
    const uniqueIds = [...new Set(ids.map((id) => segment(id, 'Entity id')))]
    const campaignPath = this.campaignPath(campaignId)
    await this.storage.runTransaction(async (transaction) => {
      const campaign = await transaction.get<CampaignDocument>(campaignPath)
      if (!campaign) throw new Error(`Campaign ${campaignId} does not exist`)
      if (!canAccessCampaign(campaign.data, masterId)) throw new CampaignPermissionError('archive entities in this campaign')
      for (const id of uniqueIds) {
        const path = `${campaignPath}/entities/${id}`
        const entity = await transaction.get<TargetEntityDocument>(path)
        if (!entity) throw new Error(`Entity ${id} does not exist`)
        transaction.patch<TargetEntityDocument>(path, { archived, updatedAt: now }, { revision: entity.revision })
      }
    })
  }
}
