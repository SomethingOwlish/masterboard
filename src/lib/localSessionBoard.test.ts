import { describe, expect, it } from 'vitest'
import { addSceneMember, fitSceneToMembers, moveSceneMember, removeBoardScene, removeSceneMember, scenePosition } from './localSessionBoard'
import { createLocalCampaignCatalog, nextLocalSession, type LocalSessionScene } from '../fixtures/localCampaignCatalog'

const seed = (): LocalSessionScene[] => [
  { id: 'gate', title: 'Ворота', purpose: 'Войти', memberIds: ['captain'], position: { x: -200, y: 80 }, tokenPositions: { captain: { x: 30, y: 70 } }, nextSceneIds: ['port'] },
  { id: 'port', title: 'Порт', purpose: 'Отплыть', memberIds: [], position: { x: 500, y: 400 } },
]
describe('real session board', () => {
  it('provides non-overlapping positions for existing scenes without deleting their members', () => {
    const old = [{ id: 'a', title: 'A', purpose: '', memberIds: ['hero'] }, { id: 'b', title: 'B', purpose: '' }]
    expect(scenePosition(old[0], 0)).not.toEqual(scenePosition(old[1], 1))
    expect(old[0].memberIds).toEqual(['hero'])
  })
  it('adds the same live entity to several scenes independently', () => {
    const scenes = addSceneMember(seed(), 'port', 'captain', { x: 100, y: 80 })
    expect(scenes[0].memberIds).toEqual(['captain'])
    expect(scenes[1].memberIds).toEqual(['captain'])
    expect(scenes[1].tokenPositions?.captain).toEqual({ x: 100, y: 80 })
    expect(addSceneMember(scenes, 'port', 'captain')[1].memberIds).toEqual(['captain'])
  })
  it('moves a placement across scenes without mutating its source snapshot', () => {
    const before = seed()
    const moved = moveSceneMember(before, 'gate', 'port', 'captain', { x: 40, y: 90 })
    expect(before[0].memberIds).toEqual(['captain'])
    expect(moved[0].memberIds).toEqual([])
    expect(moved[1].memberIds).toEqual(['captain'])
    expect(moved[1].tokenPositions?.captain).toEqual({ x: 40, y: 90 })
    expect(moveSceneMember(before, 'gate', 'missing', 'captain', { x: 0, y: 0 })).toEqual(before)
  })
  it('removes one placement without removing other placements', () => {
    const both = addSceneMember(seed(), 'port', 'captain')
    const removed = removeSceneMember(both, 'gate', 'captain')
    expect(removed[0].memberIds).toEqual([])
    expect(removed[1].memberIds).toEqual(['captain'])
  })
  it('removes transitions to deleted scenes', () => {
    expect(removeBoardScene(seed(), 'port')).toHaveLength(1)
    expect(removeBoardScene(seed(), 'port')[0].nextSceneIds).toEqual([])
  })
  it('grows a scene to contain a dropped token and keeps it below the header', () => {
    const scenes = addSceneMember(seed(), 'port', 'captain', { x: 500, y: -20 })
    expect(scenes[1].size?.width).toBeGreaterThanOrEqual(700)
    expect(scenes[1].tokenPositions?.captain.y).toBe(64)
  })
  it('round trips positions, tokens and arrows through save, archive and backup', () => {
    const entries = new Map<string, string>()
    const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value) }, removeItem: (key: string) => { entries.delete(key) } }
    const catalog = createLocalCampaignCatalog(storage)
    let campaign = catalog.create('Кампания', '')
    campaign = catalog.update({ ...campaign, firstSessionTitle: 'Первая', firstSessionStatus: 'completed', firstSessionScenes: seed() })
    expect(createLocalCampaignCatalog(storage).find(campaign.id)?.firstSessionScenes).toEqual(seed())
    campaign = catalog.update(nextLocalSession(campaign, 'Вторая'))
    expect(campaign.sessionHistory?.[0].scenes).toEqual(seed())
    catalog.importBackup(catalog.exportBackup())
    expect(catalog.load().campaigns[1].sessionHistory?.[0].scenes).toEqual(seed())
  })
  it('rejects malformed canvas coordinates without overwriting a valid campaign', () => {
    const entries = new Map<string, string>()
    const catalog = createLocalCampaignCatalog({ getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value) }, removeItem: (key) => { entries.delete(key) } })
    const campaign = catalog.create('Кампания', '')
    expect(() => catalog.update({ ...campaign, firstSessionScenes: [{ ...seed()[0], position: { x: NaN, y: 0 } }] })).toThrow()
    expect(catalog.find(campaign.id)?.firstSessionScenes).toEqual([])
  })
})

it('expands a previously resized scene when adding members in the structured editor', () => {
  const scene = fitSceneToMembers({ id: 'scene', title: 'Scene', purpose: '', size: { width: 240, height: 160 }, memberIds: ['a', 'b', 'c', 'd'] })
  expect(scene.size!.height).toBeGreaterThan(280)
})
