import { describe, expect, it } from 'vitest'
import { exportEntities, relateTo } from './bulk'
import { newEntity } from './domain'
import { consumeInbox, newInboxItem } from './inbox'
import { importEntitiesFile, importTasks, logImport } from './imports'
import { normalizeCampaign } from './normalize'
import { TIMELINE_DEFAULT, filterTimeline, timeline } from './plan'
import type { LocalSessionPlanItem, LocalSessionRecord } from './types'

const NOW = '2026-09-27T12:00:00.000Z'
const empty = () => normalizeCampaign({ id: 'c', name: 'К' }, NOW)!

describe('import section (ТЗ-2, R6)', () => {
  it('takes in a file of entities with new ids and their relations, and logs it', () => {
    const from = relateTo(normalizeCampaign({ id: 'a', name: 'Порт', entities: [newEntity({ id: 'x', type: 'npc', name: 'Олан' }), newEntity({ id: 'y', type: 'faction', name: 'Гильдия' })] }, NOW)!, ['x'], 'y', 'belongs', '')
    const { campaign, added } = importEntitiesFile(empty(), exportEntities(from, ['x', 'y'], NOW), NOW)
    expect(added).toBe(2)
    expect(campaign.entities.map((entity) => entity.id)).not.toContain('x')
    expect(campaign.relations[0]).toMatchObject({ fromId: campaign.entities[0].id, toId: campaign.entities[1].id })
    expect(campaign.entities[0].origin.kind).toBe('import')
    expect(campaign.importLog).toEqual([expect.objectContaining({ source: 'Файл сущностей из «Порт»', kind: 'file', count: 2 })])
    expect(() => importEntitiesFile(empty(), '{"format":"x"}', NOW)).toThrow(/не файл сущностей/)
    expect(logImport(empty(), 'Мир', 'records', 0, NOW).importLog).toBeUndefined()
  })

  it('lists what is left to sort out after imports', () => {
    const campaign = normalizeCampaign({ id: 'c', name: 'К', entities: [newEntity({ type: 'note', name: 'Осада', origin: { kind: 'import' } }), newEntity({ type: 'npc', name: 'Олан', description: 'есть', tags: ['т'], origin: { kind: 'import' } }), newEntity({ type: 'npc', name: 'Своё' })] }, NOW)!
    expect(importTasks(campaign).map((task) => [task.id, task.count])).toEqual([['tags', 1], ['description', 1], ['notes', 1]])
  })

  it('turns an inbox note into an entity of the chosen type with its tags', () => {
    const item = newInboxItem('Мирта Солеварка #порт', NOW)
    const next = consumeInbox({ ...empty(), inbox: [item] }, item, 'entity', 'npc')
    expect(next.inbox).toEqual([])
    expect(next.entities[0]).toMatchObject({ type: 'npc', name: 'Мирта Солеварка', tags: ['порт'], origin: { kind: 'inbox' } })
  })
})

describe('timeline switches (ТЗ-2, R8)', () => {
  const item = (id: string, kind: LocalSessionPlanItem['kind'], status: LocalSessionPlanItem['status'] = 'prepared', sceneId?: string): LocalSessionPlanItem => ({ id, source: 'text', text: id, kind, priority: 'useful', status, role: '', alternative: '', note: '', origin: 'prepared', sceneId })
  const session = { planItems: [item('scene', 'scene'), item('hero', 'npc', 'prepared', 'scene'), item('storm', 'event', 'prepared', 'scene'), item('note', 'note'), item('skipped', 'event', 'skipped')] } as unknown as LocalSessionRecord
  it('shows only scenes and events by default, children included', () => {
    expect(filterTimeline(timeline(session), TIMELINE_DEFAULT)).toEqual([{ kind: 'single', item: session.planItems[0], children: [session.planItems[2]] }])
    expect(filterTimeline(timeline(session), { ...TIMELINE_DEFAULT, others: true, dropped: true })).toHaveLength(3)
  })
})
