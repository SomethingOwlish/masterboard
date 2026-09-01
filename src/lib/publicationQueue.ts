import type { ExternalGateway } from '../adapters/fakeExternal'
import type { CapabilityPassport, PublicationQueueItem } from '../model/external'
import { preparePublication } from './externalModel'

export interface BatchPreview {
  ready: PublicationQueueItem[]
  blocked: PublicationQueueItem[]
}

export interface BatchResult {
  items: PublicationQueueItem[]
  succeeded: number
  failed: number
  skipped: number
}

export function validateQueueItem(item: PublicationQueueItem): string[] {
  const errors: string[] = []
  if (!item.entityId.trim()) errors.push('Entity is required')
  if (!item.entityType.trim()) errors.push('Entity type is required')
  if (!item.connectionId.trim()) errors.push('Destination connection is required')
  if (Object.keys(item.patch).length === 0) errors.push('At least one changed field is required')
  return errors
}

/** Prepare every item independently; one invalid item never blocks the rest. */
export function previewBatch(
  items: PublicationQueueItem[],
  passports: CapabilityPassport[],
): BatchPreview {
  const byConnection = new Map(passports.map((passport) => [passport.connectionId, passport]))
  const prepared = items.map((item) => {
    const validation = validateQueueItem(item)
    if (validation.length) return { ...item, state: 'blocked' as const, error: validation.join('. ') }
    const passport = byConnection.get(item.connectionId)
    if (!passport) return { ...item, state: 'blocked' as const, error: 'Capability passport is unavailable' }
    return preparePublication(item, passport, item.entityType)
  })
  return {
    ready: prepared.filter((item) => item.state === 'ready'),
    blocked: prepared.filter((item) => item.state === 'blocked'),
  }
}

export function confirmReady(items: PublicationQueueItem[], confirmedAt: string): PublicationQueueItem[] {
  return items.map((item) => item.state === 'ready' ? { ...item, confirmedAt } : item)
}

/** Execute ready items separately and retain an individual result for each one. */
export async function executeBatch(
  items: PublicationQueueItem[],
  gateway: ExternalGateway,
  completedAt: string,
): Promise<BatchResult> {
  const next = await Promise.all(items.map(async (item): Promise<PublicationQueueItem> => {
    if (item.state !== 'ready' || !item.confirmedAt) return item
    try {
      const result = await gateway.publish(item)
      return { ...result, completedAt }
    } catch (error) {
      return {
        ...item,
        state: 'failed',
        completedAt,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }))
  return {
    items: next,
    succeeded: next.filter((item) => item.state === 'succeeded').length,
    failed: next.filter((item) => item.state === 'failed').length,
    skipped: next.filter((item) => item.state !== 'succeeded' && item.state !== 'failed').length,
  }
}

/** Return only failed operations to the confirmed ready state for an explicit retry. */
export function retryFailed(items: PublicationQueueItem[], confirmedAt: string): PublicationQueueItem[] {
  return items
    .filter((item) => item.state === 'failed')
    .map((item) => ({
      ...item,
      state: 'ready' as const,
      confirmedAt,
      completedAt: undefined,
      error: undefined,
    }))
}
