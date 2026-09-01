import { describe, expect, it } from 'vitest'
import { FakeExternalGateway } from '../adapters/fakeExternal'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import type { CapabilityPassport, ExternalConnection, PublicationQueueItem } from '../model/external'
import { CampaignPermissionError } from './campaignRepository'
import { PublicationManager } from './publicationManager'

const CAMPAIGN = 'moon-port'
const CREATED = '2026-09-01T12:00:00.000Z'
const connection: ExternalConnection = {
  id: 'fake-lovegame', system: 'lovegame', scope: 'campaign', externalId: 'fake-campaign', label: 'Fake Lovegame', state: 'active',
}
const passport: CapabilityPassport = {
  connectionId: connection.id, fetchedAt: CREATED,
  entities: [
    { entityType: 'npc', label: 'NPC', enabled: true, operations: ['read', 'update', 'change-name'] },
    { entityType: 'rumor', label: 'Rumor', enabled: false, operations: ['read', 'create'], unavailableReason: 'Rumor module is disabled' },
  ],
}

function queue(id: string, overrides: Partial<PublicationQueueItem> = {}) {
  return {
    id, entityId: `entity-${id}`, entityType: 'npc', connectionId: connection.id,
    operation: 'update', patch: { name: id }, state: 'draft', createdAt: CREATED, updatedAt: CREATED,
    ...overrides,
  }
}

function setup(failIds: ReadonlySet<string> = new Set()) {
  const storage = new MemoryStorageGateway({
    [`campaigns/${CAMPAIGN}`]: {
      name: 'Moon Port', mode: 'single-group', ownerId: 'owl', coMasterId: 'fox', createdAt: CREATED, updatedAt: CREATED,
    },
    [`campaigns/${CAMPAIGN}/publicationQueue/rename-fox`]: queue('rename-fox'),
    [`campaigns/${CAMPAIGN}/publicationQueue/update-gate`]: queue('update-gate'),
    [`campaigns/${CAMPAIGN}/publicationQueue/create-rumor`]: queue('create-rumor', { entityType: 'rumor', operation: 'create' }),
  })
  const gateway = new FakeExternalGateway([connection], [passport], failIds)
  return { storage, gateway, manager: new PublicationManager(storage, gateway) }
}

describe('PublicationManager', () => {
  it('previews drafts against fake capabilities and keeps blocked rows visible', async () => {
    const { manager, gateway } = setup()
    const snapshot = await manager.preview(CAMPAIGN, 'owl', '2026-09-01T12:01:00.000Z')
    expect(snapshot.counts).toMatchObject({ ready: 2, blocked: 1, succeeded: 0 })
    expect(snapshot.active.find((item) => item.id === 'create-rumor')).toMatchObject({
      state: 'blocked', error: 'Rumor module is disabled',
    })
    expect(gateway.published).toEqual([])
  })

  it('requires both row confirmation and explicit send confirmation', async () => {
    const { manager, gateway } = setup()
    await manager.preview(CAMPAIGN, 'fox', '2026-09-01T12:01:00.000Z')
    await expect(manager.confirm(CAMPAIGN, 'fox', ['create-rumor'], '2026-09-01T12:02:00.000Z'))
      .rejects.toThrow('Only previewed ready operations can be confirmed')
    await manager.confirm(CAMPAIGN, 'fox', ['rename-fox'], '2026-09-01T12:02:00.000Z')
    await expect(manager.execute(CAMPAIGN, 'fox', '2026-09-01T12:03:00.000Z', false))
      .rejects.toThrow('explicit send confirmation')
    expect(gateway.published).toEqual([])
  })

  it('moves successes to history and leaves failures active after a partial result', async () => {
    const { manager } = setup(new Set(['update-gate']))
    await manager.preview(CAMPAIGN, 'owl', '2026-09-01T12:01:00.000Z')
    await manager.confirm(CAMPAIGN, 'owl', ['rename-fox', 'update-gate'], '2026-09-01T12:02:00.000Z')
    const snapshot = await manager.execute(CAMPAIGN, 'owl', '2026-09-01T12:03:00.000Z', true)
    expect(snapshot.history.map((item) => item.id)).toEqual(['rename-fox'])
    expect(snapshot.active.find((item) => item.id === 'update-gate')).toMatchObject({
      state: 'failed', error: 'Configured fake failure for update-gate',
    })
    expect(snapshot.counts).toMatchObject({ failed: 1, blocked: 1, succeeded: 1 })
  })

  it('retries only explicitly selected failures and enforces campaign access', async () => {
    const { manager } = setup(new Set(['update-gate']))
    await manager.preview(CAMPAIGN, 'owl', '2026-09-01T12:01:00.000Z')
    await manager.confirm(CAMPAIGN, 'owl', ['update-gate'], '2026-09-01T12:02:00.000Z')
    await manager.execute(CAMPAIGN, 'owl', '2026-09-01T12:03:00.000Z', true)
    const retried = await manager.retry(CAMPAIGN, 'owl', ['update-gate'], '2026-09-01T12:04:00.000Z')
    expect(retried.active.find((item) => item.id === 'update-gate')).toMatchObject({ state: 'ready', error: undefined })
    await expect(manager.snapshot(CAMPAIGN, 'outsider')).rejects.toBeInstanceOf(CampaignPermissionError)
  })
})

