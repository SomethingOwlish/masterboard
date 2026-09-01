import { describe, expect, it } from 'vitest'
import { FakeExternalGateway } from '../adapters/fakeExternal'
import type {
  CapabilityPassport,
  ExternalConnection,
  ExternalProjection,
  FieldDifference,
  PublicationQueueItem,
} from '../model/external'
import { canPublish, needsAttention, preparePublication, projectionState, resolveDifference } from './externalModel'

const connection: ExternalConnection = {
  id: 'conn-lovegame',
  system: 'lovegame',
  scope: 'campaign',
  externalId: 'fake-campaign',
  label: 'Fake Lovegame campaign',
  state: 'active',
}

const passport: CapabilityPassport = {
  connectionId: connection.id,
  fetchedAt: '2026-09-01T10:00:00.000Z',
  entities: [
    {
      entityType: 'npc',
      label: 'NPC',
      enabled: true,
      operations: ['read', 'create', 'update', 'change-status'],
    },
    {
      entityType: 'rumor',
      label: 'Rumor',
      enabled: false,
      operations: ['read', 'create'],
      unavailableReason: 'Rumors module is disabled in the fake campaign',
    },
  ],
}

const queueItem: PublicationQueueItem = {
  id: 'pub-1',
  entityId: 'npc-1',
  connectionId: connection.id,
  operation: 'update',
  patch: { name: 'The Fox' },
  state: 'draft',
  createdAt: '2026-09-01T10:01:00.000Z',
}

describe('capability passport', () => {
  it('allows only operations explicitly exposed by an enabled module', () => {
    expect(canPublish(passport, 'npc', 'update')).toEqual({ allowed: true })
    expect(canPublish(passport, 'npc', 'archive')).toEqual({
      allowed: false,
      reason: 'Operation archive is not supported by this connection',
    })
    expect(canPublish(passport, 'rumor', 'create')).toEqual({
      allowed: false,
      reason: 'Rumors module is disabled in the fake campaign',
    })
  })

  it('blocks a queue item before it can reach an adapter', () => {
    expect(preparePublication({ ...queueItem, operation: 'archive' }, passport, 'npc')).toMatchObject({
      state: 'blocked',
      error: 'Operation archive is not supported by this connection',
    })
  })
})

describe('conflict resolution', () => {
  const difference: FieldDifference = {
    field: 'name',
    masterboardValue: 'The Fox',
    externalValue: 'Fox',
    masterboardChangedAt: '2026-09-01T10:00:00.000Z',
    externalChangedAt: '2026-09-01T09:00:00.000Z',
  }

  it('keeps a deferred difference quiet until either side changes again', () => {
    const deferred = resolveDifference(difference, 'defer')
    expect(needsAttention(deferred)).toBe(false)
    expect(needsAttention({ ...deferred, externalChangedAt: '2026-09-01T11:00:00.000Z' })).toBe(true)
  })

  it('requires the third value for option C', () => {
    expect(() => resolveDifference(difference, 'use-custom')).toThrow(/requires a value/)
    expect(resolveDifference(difference, 'use-custom', 'Silver Fox').customValue).toBe('Silver Fox')
  })

  it('derives projection state from field-level decisions', () => {
    const projection: ExternalProjection = {
      id: 'projection-1',
      entityId: 'npc-1',
      connectionId: connection.id,
      externalId: 'external-npc-1',
      externalType: 'npc',
      visibility: 'masters-only',
      syncState: 'in-sync',
      mapping: [],
    }
    expect(projectionState(projection, {
      id: 'conflict-1',
      projectionId: projection.id,
      detectedAt: '2026-09-01T10:00:00.000Z',
      differences: [difference],
    })).toBe('conflict')
    expect(projectionState(projection, {
      id: 'conflict-1',
      projectionId: projection.id,
      detectedAt: '2026-09-01T10:00:00.000Z',
      differences: [resolveDifference(difference, 'intentional')],
    })).toBe('in-sync')
  })
})

describe('fake external gateway', () => {
  it('publishes in memory without a real integration', async () => {
    const gateway = new FakeExternalGateway([connection], [passport])
    const ready = preparePublication(queueItem, passport, 'npc')
    const result = await gateway.publish({ ...ready, confirmedAt: '2026-09-01T10:02:00.000Z' })
    expect(result.state).toBe('succeeded')
    expect(gateway.published).toHaveLength(1)
    expect(await gateway.listConnections()).toEqual([connection])
  })
})
