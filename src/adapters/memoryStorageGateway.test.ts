import { describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from './memoryStorageGateway'
import { StorageConflictError } from '../storage/gateway'

interface CampaignDocument extends Record<string, unknown> {
  name: string
  ownerId: string
  coMasterId?: string
  mode: 'single' | 'groups'
}

describe('MemoryStorageGateway', () => {
  it('patches only declared fields and advances the revision', async () => {
    const gateway = new MemoryStorageGateway({
      'campaigns/camp-1': { name: 'Night City', ownerId: 'master-1', mode: 'single' },
    })
    const before = await gateway.get<CampaignDocument>('campaigns/camp-1')
    const after = await gateway.patch<CampaignDocument>(
      'campaigns/camp-1',
      { name: 'Night City Revised' },
      { revision: before?.revision },
    )
    expect(after).toEqual({
      path: 'campaigns/camp-1', revision: 2,
      data: { name: 'Night City Revised', ownerId: 'master-1', mode: 'single' },
    })
  })

  it('rejects a stale write precondition', async () => {
    const gateway = new MemoryStorageGateway({ 'campaigns/camp-1': { name: 'First' } })
    await gateway.patch('campaigns/camp-1', { name: 'Second' }, { revision: 1 })
    await expect(gateway.patch('campaigns/camp-1', { name: 'Stale' }, { revision: 1 }))
      .rejects.toBeInstanceOf(StorageConflictError)
  })

  it('commits a multi-document transaction atomically', async () => {
    const gateway = new MemoryStorageGateway({
      'campaigns/camp-1': { name: 'Night City' },
      'campaigns/camp-1/tasks/task-1': { title: 'Old', state: 'todo' },
    })
    await gateway.runTransaction(async (transaction) => {
      transaction.patch('campaigns/camp-1', { name: 'New Night City' })
      transaction.patch('campaigns/camp-1/tasks/task-1', { state: 'done' })
    })
    expect((await gateway.get('campaigns/camp-1'))?.data.name).toBe('New Night City')
    expect((await gateway.get('campaigns/camp-1/tasks/task-1'))?.data.state).toBe('done')
  })

  it('rolls back every transaction write when work fails', async () => {
    const gateway = new MemoryStorageGateway({ 'campaigns/camp-1': { name: 'Stable' } })
    await expect(gateway.runTransaction(async (transaction) => {
      transaction.patch('campaigns/camp-1', { name: 'Never committed' })
      transaction.patch('campaigns/missing', { name: 'Failure' })
    })).rejects.toThrow('Cannot patch missing document')
    expect((await gateway.get('campaigns/camp-1'))?.data.name).toBe('Stable')
  })

  it('lists only direct documents in a collection', async () => {
    const gateway = new MemoryStorageGateway({
      'campaigns/camp-b': { name: 'B' },
      'campaigns/camp-a': { name: 'A' },
      'campaigns/camp-a/tasks/task-1': { title: 'Nested' },
      'players/player-1': { name: 'Player' },
    })
    expect((await gateway.list('campaigns')).map((entry) => entry.path)).toEqual([
      'campaigns/camp-a', 'campaigns/camp-b',
    ])
  })

  it('serializes concurrent transactions so increments are not lost', async () => {
    const gateway = new MemoryStorageGateway({ 'counters/main': { value: 0 } })
    const increment = () => gateway.runTransaction(async (transaction) => {
      const current = await transaction.get<{ value: number }>('counters/main')
      transaction.patch('counters/main', { value: (current?.data.value ?? 0) + 1 })
    })
    await Promise.all([increment(), increment(), increment()])
    expect((await gateway.get('counters/main'))?.data.value).toBe(3)
  })
})
