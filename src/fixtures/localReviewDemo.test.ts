import { describe, expect, it } from 'vitest'
import { createLocalReviewDemo } from './localReviewDemo'

describe('local session review', () => {
  it('requires a decision for every fact', () => {
    const demo = createLocalReviewDemo()
    expect(() => demo.complete()).toThrow('Every fact')
  })
  it('builds and locks a completed review', () => {
    const demo = createLocalReviewDemo()
    for (const fact of demo.read().facts) demo.decide(fact.id, fact.id === 'favor' ? 'carry-forward' : 'resolved')
    expect(demo.complete().completed).toBe(true)
    expect(() => demo.saveNotes('late')).toThrow('already complete')
  })
})
