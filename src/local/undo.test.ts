import { describe, expect, it } from 'vitest'
import { normalizeCampaign } from './normalize'
import { newTask } from './sessionFlow'
import { restoreRemoved } from './undo'

const NOW = '2026-09-27T10:00:00.000Z'
const base = () => ({ ...normalizeCampaign({ id: 'c', name: 'Кампания', notes: [] }, NOW)!, tasks: [{ ...newTask('Карта', 'masterboard'), id: 't1' }, { ...newTask('Музыка', 'masterboard'), id: 't2' }] })

describe('restoreRemoved', () => {
  it('goes back to the exact version when nothing changed since the delete', () => {
    const before = base()
    const after = { ...before, tasks: before.tasks.filter((task) => task.id !== 't1') }
    expect(restoreRemoved(before, after, after)).toBe(before)
  })

  it('brings the deleted item back and keeps edits made after the delete', () => {
    const before = base()
    const after = { ...before, tasks: before.tasks.filter((task) => task.id !== 't1') }
    const current = { ...after, activeTime: 'Ночь', tasks: after.tasks.map((task) => ({ ...task, done: true })) }
    const restored = restoreRemoved(before, after, current)
    expect(restored.activeTime).toBe('Ночь')
    expect(restored.tasks.map((task) => [task.id, task.done])).toEqual([['t2', true], ['t1', false]])
  })
})
