import { describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { CampaignPermissionError } from './campaignRepository'
import { CampaignContentRepository, type CampaignContentDocument } from './campaignContentRepository'
import { StorageConflictError } from './gateway'

interface TaskDocument extends CampaignContentDocument {
  title: string
  state: 'todo' | 'doing' | 'done' | 'cancelled'
  tags: string[]
}

const NOW = '2026-09-01T15:00:00.000Z'

function setup() {
  const storage = new MemoryStorageGateway({
    'campaigns/camp-1': {
      name: 'Shared campaign', mode: 'single-group', ownerId: 'owner', coMasterId: 'co-master',
      createdAt: NOW, updatedAt: NOW,
    },
    'campaigns/camp-private': {
      name: 'Private campaign', mode: 'single-group', ownerId: 'other-owner',
      createdAt: NOW, updatedAt: NOW,
    },
  })
  return { storage, tasks: new CampaignContentRepository<TaskDocument>(storage, 'tasks') }
}

describe('CampaignContentRepository', () => {
  it('allows owner and co-master to create and edit the same content', async () => {
    const { tasks } = setup()
    const created = await tasks.create('camp-1', 'task-1', 'owner', {
      title: 'Prepare scene', state: 'todo', tags: ['session'],
    }, NOW)
    const updated = await tasks.patch(
      'camp-1', 'task-1', 'co-master', { state: 'doing' },
      '2026-09-01T15:01:00.000Z', created.revision,
    )
    expect(updated.data).toMatchObject({ title: 'Prepare scene', state: 'doing', tags: ['session'] })
    expect(updated.data.createdAt).toBe(NOW)
    expect(updated.data.updatedAt).toBe('2026-09-01T15:01:00.000Z')
  })

  it('keeps campaign content invisible to unrelated masters', async () => {
    const { tasks } = setup()
    await tasks.create('camp-1', 'task-1', 'owner', { title: 'Secret', state: 'todo', tags: [] }, NOW)
    await expect(tasks.get('camp-1', 'task-1', 'outsider')).rejects.toBeInstanceOf(CampaignPermissionError)
    await expect(tasks.list('camp-1', 'outsider')).rejects.toBeInstanceOf(CampaignPermissionError)
    await expect(tasks.patch('camp-1', 'task-1', 'outsider', { state: 'done' }, NOW))
      .rejects.toBeInstanceOf(CampaignPermissionError)
  })

  it('lists only the selected campaign subcollection', async () => {
    const { storage, tasks } = setup()
    await tasks.create('camp-1', 'task-b', 'owner', { title: 'B', state: 'todo', tags: [] }, NOW)
    await tasks.create('camp-1', 'task-a', 'owner', { title: 'A', state: 'todo', tags: [] }, NOW)
    await storage.set('campaigns/camp-1/entities/entity-1', { name: 'Not a task' })
    await storage.set('campaigns/camp-private/tasks/private-task', { title: 'Not visible' })
    expect((await tasks.list('camp-1', 'co-master')).map((task) => task.path)).toEqual([
      'campaigns/camp-1/tasks/task-a', 'campaigns/camp-1/tasks/task-b',
    ])
  })

  it('rejects a stale entity revision without changing the document', async () => {
    const { tasks } = setup()
    const created = await tasks.create('camp-1', 'task-1', 'owner', {
      title: 'Original', state: 'todo', tags: [],
    }, NOW)
    await tasks.patch('camp-1', 'task-1', 'owner', { title: 'Current' }, NOW, created.revision)
    await expect(tasks.patch('camp-1', 'task-1', 'co-master', { title: 'Stale' }, NOW, created.revision))
      .rejects.toBeInstanceOf(StorageConflictError)
    expect((await tasks.get('camp-1', 'task-1', 'owner'))?.data.title).toBe('Current')
  })

  it('lets either campaign master remove content', async () => {
    const { tasks } = setup()
    const created = await tasks.create('camp-1', 'task-1', 'owner', {
      title: 'Temporary', state: 'todo', tags: [],
    }, NOW)
    await tasks.remove('camp-1', 'task-1', 'co-master', created.revision)
    expect(await tasks.get('camp-1', 'task-1', 'owner')).toBeNull()
  })

  it('rejects ids that could escape their collection path', async () => {
    const { tasks } = setup()
    await expect(tasks.create('camp-1', '../entities/injected', 'owner', {
      title: 'Invalid', state: 'todo', tags: [],
    }, NOW)).rejects.toThrow('Document id must be a non-empty path segment')
  })
})
