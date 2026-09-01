import { describe, expect, it } from 'vitest'
import { FakeExternalGateway } from '../adapters/fakeExternal'
import type { CapabilityPassport, ExternalConnection, PublicationQueueItem } from '../model/external'
import { confirmReady, executeBatch, previewBatch, retryFailed, validateQueueItem } from './publicationQueue'

const connection: ExternalConnection = {
  id: 'conn-fake', system: 'lovegame', scope: 'campaign', externalId: 'campaign-fake',
  label: 'Fake campaign', state: 'active',
}

const passport: CapabilityPassport = {
  connectionId: connection.id,
  fetchedAt: '2026-09-01T12:00:00.000Z',
  entities: [
    { entityType: 'npc', label: 'NPC', enabled: true, operations: ['read', 'create', 'update', 'change-status'] },
    { entityType: 'rumor', label: 'Rumor', enabled: false, operations: ['read', 'create'], unavailableReason: 'Fake module disabled' },
  ],
}

function item(id: string, patch: Record<string, unknown> = { name: id }): PublicationQueueItem {
  return {
    id, entityId: `entity-${id}`, entityType: 'npc', connectionId: connection.id,
    operation: 'update', patch, state: 'draft', createdAt: '2026-09-01T12:01:00.000Z',
  }
}

describe('publication batch preview', () => {
  it('validates records without touching an adapter', () => {
    expect(validateQueueItem(item('empty', {}))).toEqual(['At least one changed field is required'])
  })

  it('prepares supported items and blocks every bad item independently', () => {
    const unsupported = { ...item('archive'), operation: 'archive' as const }
    const missingPassport = { ...item('missing'), connectionId: 'unknown' }
    const preview = previewBatch([item('ok'), unsupported, missingPassport], [passport])
    expect(preview.ready.map((entry) => entry.id)).toEqual(['ok'])
    expect(preview.blocked).toMatchObject([
      { id: 'archive', error: 'Operation archive is not supported by this connection' },
      { id: 'missing', error: 'Capability passport is unavailable' },
    ])
  })
})

describe('publication batch execution', () => {
  it('keeps partial success and returns separate results', async () => {
    const gateway = new FakeExternalGateway([connection], [passport], new Set(['fail']))
    const preview = previewBatch([item('ok'), item('fail'), { ...item('blocked'), operation: 'archive' }], [passport])
    const confirmed = confirmReady([...preview.ready, ...preview.blocked], '2026-09-01T12:02:00.000Z')
    const result = await executeBatch(confirmed, gateway, '2026-09-01T12:03:00.000Z')
    expect(result).toMatchObject({ succeeded: 1, failed: 1, skipped: 1 })
    expect(result.items.find((entry) => entry.id === 'ok')?.state).toBe('succeeded')
    expect(result.items.find((entry) => entry.id === 'fail')).toMatchObject({
      state: 'failed', error: 'Configured fake failure for fail',
    })
    expect(result.items.find((entry) => entry.id === 'blocked')?.state).toBe('blocked')
  })

  it('retries only failed operations', () => {
    const failed = { ...item('failed'), state: 'failed' as const, error: 'fake error' }
    const succeeded = { ...item('done'), state: 'succeeded' as const }
    expect(retryFailed([failed, succeeded], '2026-09-01T12:04:00.000Z')).toEqual([
      expect.objectContaining({ id: 'failed', state: 'ready', error: undefined }),
    ])
  })
})
