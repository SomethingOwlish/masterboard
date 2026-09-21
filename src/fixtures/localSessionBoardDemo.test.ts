import { describe, expect, it } from 'vitest'
import { createLocalSessionBoardDemo } from './localSessionBoardDemo'

describe('local session board demo', () => {
  it('moves a live item to exactly one scene', () => {
    const demo = createLocalSessionBoardDemo()
    const next = demo.moveItem('fox', 'gate')
    expect(next.scenes.find((scene) => scene.id === 'bargain')?.itemIds).not.toContain('fox')
    expect(next.scenes.find((scene) => scene.id === 'gate')?.itemIds).toContain('fox')
    expect(next.revision).toBe(1)
  })

  it('reorders scenes and marks the plan ready', () => {
    const demo = createLocalSessionBoardDemo()
    expect(demo.reorderScene('bargain', -1).scenes.map((scene) => scene.id)).toEqual(['bargain', 'arrival', 'gate'])
    expect(demo.toggleReady().ready).toBe(true)
  })

  it('rejects unknown references', () => {
    const demo = createLocalSessionBoardDemo()
    expect(() => demo.moveItem('missing', 'gate')).toThrow('Unknown board item')
  })
})

it('uses production scene placements without discarding layout or copies in other scenes', () => {
  const demo = createLocalSessionBoardDemo()
  const scenes = demo.read().scenes.map(({ itemIds, ...scene }) => ({ ...scene, memberIds: [...itemIds, 'fox'], position: { x: 120, y: -40 }, nextSceneIds: ['gate'] }))
  const next = demo.replaceScenes(scenes)
  expect(next.scenes.every((scene) => scene.itemIds.includes('fox'))).toBe(true)
  expect(next.scenes[0].position).toEqual({ x: 120, y: -40 })
  expect(next.scenes[0].nextSceneIds).toEqual(['gate'])
})
