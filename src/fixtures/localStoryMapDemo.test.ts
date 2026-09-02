import { describe, expect, it } from 'vitest'
import { createLocalStoryMapDemo } from './localStoryMapDemo'

describe('local story map demo', () => {
  it('returns isolated fake snapshots', () => {
    const demo = createLocalStoryMapDemo()
    const snapshot = demo.load()
    snapshot.entities[0].name = 'changed'
    expect(demo.load().entities[0].name).toBe('Брин Вейл')
  })

  it('creates a trimmed local relation', () => {
    const demo = createLocalStoryMapDemo()
    const next = demo.addRelation({ from: 'bryn', to: 'guild', label: '  подозревает  ', visibility: 'master' })
    expect(next.relations.at(-1)).toMatchObject({ from: 'bryn', to: 'guild', label: 'подозревает' })
  })

  it('rejects self-relations and toggles visibility', () => {
    const demo = createLocalStoryMapDemo()
    expect(() => demo.addRelation({ from: 'fox', to: 'fox', label: 'знает', visibility: 'public' })).toThrow()
    expect(demo.toggleRelationVisibility('r1').relations.find((item) => item.id === 'r1')?.visibility).toBe('public')
  })
})
