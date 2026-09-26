import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { StorageConflictError } from '../storage/gateway'
import { IdbStorageGateway } from './idbStorageGateway'

let counter = 0
const gateway = () => new IdbStorageGateway({ dbName: `test-${++counter}` })

describe('IdbStorageGateway', () => {
  it('stores documents with increasing revisions and survives a new instance', async () => {
    const name = `test-${++counter}`
    const first = new IdbStorageGateway({ dbName: name })
    expect((await first.set('campaigns/a', { name: 'A' })).revision).toBe(1)
    expect((await first.patch('campaigns/a', { idea: 'x' })).revision).toBe(2)
    const reopened = new IdbStorageGateway({ dbName: name })
    expect(await reopened.get('campaigns/a')).toEqual({ path: 'campaigns/a', data: { name: 'A', idea: 'x' }, revision: 2 })
  })

  it('rejects writes with a stale revision', async () => {
    const storage = gateway()
    await storage.set('doc', { value: 1 })
    await expect(storage.patch('doc', { value: 2 }, { revision: 5 })).rejects.toBeInstanceOf(StorageConflictError)
    await expect(storage.remove('doc', { revision: 5 })).rejects.toBeInstanceOf(StorageConflictError)
    expect((await storage.get('doc'))?.data).toEqual({ value: 1 })
  })

  it('lists only direct children of a collection', async () => {
    const storage = gateway()
    await storage.set('campaigns/b', { n: 2 })
    await storage.set('campaigns/a', { n: 1 })
    await storage.set('campaigns/a/sessions/s1', { n: 3 })
    await storage.set('campaignsX/c', { n: 4 })
    expect((await storage.list('campaigns')).map((item) => item.path)).toEqual(['campaigns/a', 'campaigns/b'])
  })

  it('commits transactions atomically', async () => {
    const storage = gateway()
    await storage.set('a', { v: 1 })
    await expect(storage.runTransaction(async (tx) => {
      await tx.get('a')
      tx.patch('a', { v: 2 })
      tx.set('b', { v: 1 })
      throw new Error('boom')
    })).rejects.toThrow('boom')
    expect((await storage.get('a'))?.data).toEqual({ v: 1 })
    expect(await storage.get('b')).toBeNull()

    await storage.runTransaction(async (tx) => {
      await tx.get('a')
      tx.patch('a', { v: 2 })
      tx.set('b', { v: 1 })
    })
    expect((await storage.get('a'))?.data).toEqual({ v: 2 })
    expect((await storage.get('b'))?.data).toEqual({ v: 1 })
  })

  it('removes documents', async () => {
    const storage = gateway()
    await storage.set('a', { v: 1 })
    await storage.remove('a')
    expect(await storage.get('a')).toBeNull()
  })
})
