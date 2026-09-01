import { describe, expect, it } from 'vitest'
import { createLocalConductorDemo } from './localConductorDemo'

describe('local conductor demo', () => {
  it('advances the scene and writes the factual log', () => {
    const demo = createLocalConductorDemo()
    const next = demo.advanceScene()
    expect(next.currentScene).toBe(1)
    expect(next.log.at(-1)?.text).toContain("The Fox's bargain")
  })
  it('bounds the pressure clock and records changes', () => {
    const demo = createLocalConductorDemo()
    for (let index = 0; index < 5; index += 1) demo.tickClock(1)
    expect(demo.read().clock.value).toBe(6)
  })
  it('reveals once and prevents edits after close', () => {
    const demo = createLocalConductorDemo()
    demo.revealSecret(); demo.revealSecret(); demo.close()
    expect(demo.read().log.filter((entry) => entry.kind === 'secret')).toHaveLength(1)
    expect(() => demo.addLog('note', 'late note')).toThrow('already closed')
  })
})
