import type { ID } from './types'

/** Systems that can expose read-only projections or accept explicit publications. */
export type ExternalSystem = 'lovegame' | 'lorebook' | 'systemsetup'

export type ConnectionScope = 'campaign' | 'world' | 'system'

export interface ExternalConnection {
  id: ID
  system: ExternalSystem
  scope: ConnectionScope
  externalId: string
  label: string
  state: 'active' | 'disconnected'
  lastReadAt?: string
}

export type CapabilityOperation =
  | 'read'
  | 'create'
  | 'update'
  | 'archive'
  | 'change-status'
  | 'change-visibility'
  | 'change-tags'
  | 'change-name'

export interface EntityCapability {
  entityType: string
  label: string
  enabled: boolean
  operations: CapabilityOperation[]
  categories?: string[]
  statuses?: string[]
  shortFields?: string[]
  unavailableReason?: string
}

/** A point-in-time description of what one connection actually supports. */
export interface CapabilityPassport {
  connectionId: ID
  fetchedAt: string
  entities: EntityCapability[]
}

export type ProjectionVisibility =
  | 'external-draft'
  | 'masters-only'
  | 'campaign-members'
  | 'published-by-source-rules'
  | 'archived'

export type ProjectionSyncState =
  | 'in-sync'
  | 'local-changes'
  | 'external-changes'
  | 'conflict'
  | 'deferred'
  | 'unavailable'

export interface FieldMapping {
  localFields: string[]
  externalFields: string[]
  direction: 'bidirectional' | 'read-only' | 'publish-only'
  transform?: string
  requiresConfirmation?: boolean
}

/** One local entity can have many independent external projections. */
export interface ExternalProjection {
  id: ID
  entityId: ID
  connectionId: ID
  externalId: string
  externalType: string
  externalUrl?: string
  visibility: ProjectionVisibility
  syncState: ProjectionSyncState
  mapping: FieldMapping[]
  lastReadAt?: string
  lastPublishedAt?: string
}

export type DifferenceResolution =
  | 'use-masterboard'
  | 'use-external'
  | 'use-custom'
  | 'defer'
  | 'intentional'

export interface FieldDifference {
  field: string
  masterboardValue: unknown
  externalValue: unknown
  masterboardChangedAt?: string
  externalChangedAt?: string
  resolution?: DifferenceResolution
  customValue?: unknown
  resolvedAgainst?: {
    masterboardChangedAt?: string
    externalChangedAt?: string
  }
}

export interface ProjectionConflict {
  id: ID
  projectionId: ID
  detectedAt: string
  differences: FieldDifference[]
}

export type PublicationOperation =
  | 'create'
  | 'update'
  | 'archive'
  | 'change-status'
  | 'change-visibility'
  | 'change-tags'
  | 'change-name'

export interface PublicationQueueItem {
  id: ID
  entityId: ID
  connectionId: ID
  projectionId?: ID
  operation: PublicationOperation
  patch: Record<string, unknown>
  state: 'draft' | 'ready' | 'blocked' | 'succeeded' | 'failed'
  createdAt: string
  confirmedAt?: string
  completedAt?: string
  error?: string
}
