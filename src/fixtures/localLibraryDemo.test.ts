import { describe, expect, it } from 'vitest'
import { createLocalLibraryDemo } from './localLibraryDemo'

describe('local library demo runtime', () => {
  it('creates, finds, and archives a manual entity in one isolated workspace', async () => {
    const demo = createLocalLibraryDemo()
    const created = await demo.create({ entityType: 'item', name: 'Brass Tide Key', tags: ['clue', 'harbor'] })
    const found = await demo.load({ query: 'tide key' })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ id: created.path.split('/').at(-1), origins: ['masterboard'] })
    await demo.setArchived([found[0].id], true)
    expect(await demo.load({ query: 'tide key' })).toEqual([])
    expect(await demo.load({ query: 'tide key', includeArchived: true })).toHaveLength(1)
  })
})

