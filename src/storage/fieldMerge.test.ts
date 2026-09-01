import { describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import type { DocumentData, StorageGateway } from './gateway'
import { StorageConflictError } from './gateway'
import {
  applyResolvedEdit, changedFields, fieldValueEqual, resolveFieldConflicts, saveDocumentEdit,
} from './fieldMerge'

interface NpcDocument extends DocumentData {
  name: string
  status: string
  notes: string
  tags: string[]
}

const PATH = 'campaigns/camp-1/entities/npc-1'
const INITIAL: NpcDocument = { name: 'Fox', status: 'active', notes: 'Secret', tags: ['guild'] }

describe('field edit diff', () => {
  it('compares nested JSON values independent of object key order', () => {
    expect(fieldValueEqual({ a: 1, b: [2, 3] }, { b: [2, 3], a: 1 })).toBe(true)
    expect(fieldValueEqual({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('includes only fields changed by the local editor', () => {
    expect(changedFields(INITIAL, { name: 'Fox', status: 'inactive', tags: ['guild'] })).toEqual({
      status: 'inactive',
    })
  })
})

describe('field-level co-master save', () => {
  it('uses a direct patch without an extra read when there is no co-master', async () => {
    const memory = new MemoryStorageGateway({ [PATH]: INITIAL })
    const baseline = await memory.get<NpcDocument>(PATH)
    if (!baseline) throw new Error('fixture missing')
    const storage: StorageGateway = {
      get: async () => { throw new Error('unexpected read') },
      set: (...args) => memory.set(...args),
      patch: (...args) => memory.patch(...args),
      remove: (...args) => memory.remove(...args),
      list: (...args) => memory.list(...args),
      runTransaction: (...args) => memory.runTransaction(...args),
    }
    const result = await saveDocumentEdit({
      storage, path: PATH, baseline, edited: { status: 'inactive' }, hasCoMaster: false,
    })
    expect(result.status).toBe('saved')
    expect((await memory.get<NpcDocument>(PATH))?.data.status).toBe('inactive')
  })

  it('automatically merges changes to different fields', async () => {
    const storage = new MemoryStorageGateway({ [PATH]: INITIAL })
    const baseline = await storage.get<NpcDocument>(PATH)
    if (!baseline) throw new Error('fixture missing')
    await storage.patch(PATH, { notes: 'Changed by co-master' })
    const result = await saveDocumentEdit({
      storage, path: PATH, baseline, edited: { status: 'inactive' }, hasCoMaster: true,
    })
    expect(result.status).toBe('saved')
    expect((await storage.get<NpcDocument>(PATH))?.data).toEqual({
      ...INITIAL, notes: 'Changed by co-master', status: 'inactive',
    })
  })

  it('surfaces only fields changed differently on both sides', async () => {
    const storage = new MemoryStorageGateway({ [PATH]: INITIAL })
    const baseline = await storage.get<NpcDocument>(PATH)
    if (!baseline) throw new Error('fixture missing')
    await storage.patch(PATH, { name: 'External Fox', notes: 'Remote note' })
    const result = await saveDocumentEdit({
      storage, path: PATH, baseline,
      edited: { name: 'Silver Fox', status: 'inactive' }, hasCoMaster: true,
    })
    expect(result).toMatchObject({
      status: 'conflict',
      mergeablePatch: { status: 'inactive' },
      conflicts: [{ field: 'name', baselineValue: 'Fox', localValue: 'Silver Fox', currentValue: 'External Fox' }],
    })
    expect((await storage.get<NpcDocument>(PATH))?.data).toEqual({
      ...INITIAL, name: 'External Fox', notes: 'Remote note',
    })
  })

  it('supports A, B, C, and deferred field resolutions', async () => {
    const storage = new MemoryStorageGateway({ [PATH]: INITIAL })
    const baseline = await storage.get<NpcDocument>(PATH)
    if (!baseline) throw new Error('fixture missing')
    await storage.patch(PATH, { name: 'Current Fox', notes: 'Current note', status: 'inactive', tags: ['remote'] })
    const result = await saveDocumentEdit({
      storage, path: PATH, baseline,
      edited: { name: 'Local Fox', notes: 'Local note', status: 'retired', tags: ['local'] },
      hasCoMaster: true,
    })
    if (result.status !== 'conflict') throw new Error('expected conflict')
    expect(resolveFieldConflicts(result, {
      name: { choice: 'local' },
      notes: { choice: 'current' },
      status: { choice: 'custom', value: 'missing' },
      tags: { choice: 'defer' },
    })).toEqual({ name: 'Local Fox', notes: 'Current note', status: 'missing' })
    const resolved = await applyResolvedEdit({
      storage, conflict: result,
      resolutions: {
        name: { choice: 'local' }, notes: { choice: 'current' },
        status: { choice: 'custom', value: 'missing' }, tags: { choice: 'defer' },
      },
    })
    expect(resolved.data).toEqual({
      name: 'Local Fox', notes: 'Current note', status: 'missing', tags: ['remote'],
    })
  })

  it('requires another comparison if data changes after conflict detection', async () => {
    const storage = new MemoryStorageGateway({ [PATH]: INITIAL })
    const baseline = await storage.get<NpcDocument>(PATH)
    if (!baseline) throw new Error('fixture missing')
    await storage.patch(PATH, { name: 'Current Fox' })
    const result = await saveDocumentEdit({
      storage, path: PATH, baseline, edited: { name: 'Local Fox' }, hasCoMaster: true,
    })
    if (result.status !== 'conflict') throw new Error('expected conflict')
    await storage.patch(PATH, { name: 'Changed again' })
    await expect(applyResolvedEdit({
      storage, conflict: result, resolutions: { name: { choice: 'local' } },
    })).rejects.toBeInstanceOf(StorageConflictError)
  })
})
