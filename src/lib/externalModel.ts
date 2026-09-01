import type {
  CapabilityOperation,
  CapabilityPassport,
  DifferenceResolution,
  EntityCapability,
  ExternalProjection,
  FieldDifference,
  ProjectionConflict,
  PublicationOperation,
  PublicationQueueItem,
} from '../model/external'

const OPERATION_CAPABILITY: Record<PublicationOperation, CapabilityOperation> = {
  create: 'create',
  update: 'update',
  archive: 'archive',
  'change-status': 'change-status',
  'change-visibility': 'change-visibility',
  'change-tags': 'change-tags',
  'change-name': 'change-name',
}

export function capabilityFor(passport: CapabilityPassport, entityType: string): EntityCapability | undefined {
  return passport.entities.find((capability) => capability.entityType === entityType)
}

export function canPublish(
  passport: CapabilityPassport,
  entityType: string,
  operation: PublicationOperation,
): { allowed: boolean; reason?: string } {
  const capability = capabilityFor(passport, entityType)
  if (!capability) return { allowed: false, reason: 'Entity type is not exposed by this connection' }
  if (!capability.enabled) {
    return { allowed: false, reason: capability.unavailableReason ?? 'The source module is disabled' }
  }
  if (!capability.operations.includes(OPERATION_CAPABILITY[operation])) {
    return { allowed: false, reason: `Operation ${operation} is not supported by this connection` }
  }
  return { allowed: true }
}

export function preparePublication(
  item: PublicationQueueItem,
  passport: CapabilityPassport,
  entityType: string,
): PublicationQueueItem {
  const check = canPublish(passport, entityType, item.operation)
  return check.allowed
    ? { ...item, state: 'ready', error: undefined }
    : { ...item, state: 'blocked', error: check.reason }
}

export function resolveDifference(
  difference: FieldDifference,
  resolution: DifferenceResolution,
  customValue?: unknown,
): FieldDifference {
  if (resolution === 'use-custom' && customValue === undefined) {
    throw new Error('A custom conflict resolution requires a value')
  }
  return {
    ...difference,
    resolution,
    customValue: resolution === 'use-custom' ? customValue : undefined,
    resolvedAgainst: {
      masterboardChangedAt: difference.masterboardChangedAt,
      externalChangedAt: difference.externalChangedAt,
    },
  }
}

export function needsAttention(difference: FieldDifference): boolean {
  if (!difference.resolution) return true
  if (!difference.resolvedAgainst) return true
  return (
    difference.resolvedAgainst.masterboardChangedAt !== difference.masterboardChangedAt ||
    difference.resolvedAgainst.externalChangedAt !== difference.externalChangedAt
  )
}

export function projectionState(
  projection: ExternalProjection,
  conflict?: ProjectionConflict,
): ExternalProjection['syncState'] {
  if (!conflict) return projection.syncState
  const unresolved = conflict.differences.some(needsAttention)
  if (unresolved) return 'conflict'
  return conflict.differences.some((difference) => difference.resolution === 'defer') ? 'deferred' : 'in-sync'
}
