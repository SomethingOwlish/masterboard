import { describe, expect, it } from 'vitest'
import { blankSession } from './normalize'
import { addFlow, moveItemTo, removeItem, setItemStatus, shiftAmongPeers, timeline } from './plan'
import type { LocalSessionPlanItem, LocalSessionRecord } from './types'

const item = (id: string, patch: Partial<LocalSessionPlanItem> = {}): LocalSessionPlanItem => ({ id, source: 'text', text: id, kind: 'note', priority: 'desired', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared', ...patch })
const session = (items: LocalSessionPlanItem[]): LocalSessionRecord => ({ ...blankSession(1, '', '2026-09-26T00:00:00.000Z', 's'), planItems: items })

describe('plan', () => {
  it('skips the other open members of an "or" group when one is played', () => {
    const next = setItemStatus(session([item('a', { alternative: 'вход' }), item('b', { alternative: 'вход' }), item('c', { alternative: 'вход', status: 'used' }), item('d')]), 'a', 'used')
    expect(next.planItems.map((entry) => entry.status)).toEqual(['used', 'skipped', 'used', 'prepared'])
  })

  it('moves items before another, into a priority, or into a scene', () => {
    const base = session([item('scene', { kind: 'scene', priority: 'required' }), item('a'), item('b', { priority: 'useful' })])
    const before = moveItemTo(base, 'b', { beforeId: 'a' })
    expect(before.planItems.map((entry) => `${entry.id}:${entry.priority}`)).toEqual(['scene:required', 'b:desired', 'a:desired'])
    expect(moveItemTo(base, 'a', { priority: 'backup' }).planItems.at(-1)).toMatchObject({ id: 'a', priority: 'backup' })
    expect(moveItemTo(base, 'a', { sceneId: 'scene' }).planItems.map((entry) => entry.sceneId)).toEqual([undefined, 'scene', undefined])
    expect(moveItemTo(base, 'scene', { sceneId: 'scene' }).planItems[0].sceneId).toBeUndefined()
  })

  it('reorders in the scene tree without changing priority, and shifts among peers only', () => {
    const base = session([item('s1', { kind: 'scene' }), item('a', { sceneId: 's1', priority: 'required' }), item('loose'), item('s2', { kind: 'scene' }), item('b', { sceneId: 's1', priority: 'backup' })])
    expect(moveItemTo(base, 'b', { beforeId: 'a', keepPriority: true }).planItems.map((entry) => `${entry.id}:${entry.priority}`)).toEqual(['s1:desired', 'b:backup', 'a:required', 'loose:desired', 's2:desired'])
    expect(shiftAmongPeers(base, 's2', -1).planItems.map((entry) => entry.id)).toEqual(['s2', 's1', 'a', 'loose', 'b'])
    expect(shiftAmongPeers(base, 'a', 1).planItems.map((entry) => entry.id)).toEqual(['s1', 'loose', 's2', 'b', 'a'])
    expect(shiftAmongPeers(base, 'a', -1)).toBe(base)
  })

  it('removes an item with its transitions and scene membership', () => {
    const withFlow = addFlow(session([item('scene', { kind: 'scene' }), item('a', { sceneId: 'scene' }), item('b')]), 'scene', 'b', ' если спасли ')
    expect(withFlow.flows[0].condition).toBe('если спасли')
    expect(addFlow(withFlow, 'scene', 'b', '')).toBe(withFlow)
    const next = removeItem(withFlow, 'scene')
    expect(next.flows).toEqual([])
    expect(next.planItems.find((entry) => entry.id === 'a')?.sceneId).toBeUndefined()
  })

  it('builds a timeline with nested scene members and forks for "or" groups', () => {
    const steps = timeline(session([item('intro', { kind: 'scene' }), item('npc', { sceneId: 'intro' }), item('left', { kind: 'scene', alternative: 'путь' }), item('right', { kind: 'scene', alternative: 'путь' }), item('end')]))
    expect(steps.map((step) => step.kind === 'single' ? step.item.id : `fork:${step.branches.map((branch) => branch.item.id).join('|')}`)).toEqual(['intro', 'fork:left|right', 'end'])
    expect(steps[0].kind === 'single' && steps[0].children.map((child) => child.id)).toEqual(['npc'])
  })
})
