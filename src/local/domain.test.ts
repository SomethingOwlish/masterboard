import { describe, expect, it } from 'vitest'
import { changeSecretStatus, entityUsages, filterEntities, moveClock, newClock, newEntity, newSecret, resolveClockTrigger, usageCount } from './domain'
import { blankSession, normalizeCampaign, withLocalSessions } from './normalize'

const NOW = '2026-09-26T10:00:00.000Z'

describe('clocks', () => {
  const clock = newClock({ title: 'Прилив', segments: 4, value: 1, trigger: 'Город затоплен', thresholds: [{ id: 't2', at: 2, consequence: 'Лестницы под водой' }, { id: 't3', at: 3, consequence: 'Рынок закрыт' }] })

  it('requires a reason and stays within bounds', () => {
    expect(moveClock(clock, 1, '  ', NOW)).toBeNull()
    expect(moveClock({ ...clock, value: 0 }, -1, 'откат', NOW)).toBeNull()
  })

  it('reports thresholds crossed upward and marks them reached', () => {
    const result = moveClock(clock, 1, 'Ночь прошла', NOW)!
    expect(result.reached.map((item) => item.id)).toEqual(['t2'])
    expect(result.filled).toBe(false)
    expect(result.clock.thresholds.find((item) => item.id === 't2')?.reachedAt).toBe(NOW)
    expect(result.clock.history.at(-1)).toMatchObject({ delta: 1, reason: 'Ночь прошла' })
  })

  it('clears reached marks when rolled back below them', () => {
    const up = moveClock(clock, 1, 'вверх', NOW)!.clock
    const down = moveClock(up, -1, 'вниз', NOW)!.clock
    expect(down.thresholds.find((item) => item.id === 't2')?.reachedAt).toBeUndefined()
  })

  it('asks for confirmation when full and records the decision', () => {
    const full = moveClock({ ...clock, value: 3, thresholds: [] }, 1, 'Последняя ночь', NOW)!
    expect(full.filled).toBe(true)
    expect(resolveClockTrigger(full.clock, 'deferred', NOW).triggerStatus).toBe('deferred')
    const fired = resolveClockTrigger(full.clock, 'fired', NOW)
    expect(fired).toMatchObject({ triggerStatus: 'fired', firedAt: NOW })
    expect(fired.history.at(-1)).toMatchObject({ reason: 'Срабатывание подтверждено', note: 'Город затоплен' })
    expect(moveClock(fired, -1, 'Жертва принесена', NOW)!.clock).toMatchObject({ triggerStatus: 'idle', firedAt: undefined })
  })
})

describe('secrets', () => {
  it('records status changes in the reveal history with the session', () => {
    const secret = newSecret({ title: 'Цена', truth: 'Имена' })
    const next = changeSecretStatus(secret, { status: 'selected', recipients: 'Ира', sessionId: 'session-1', note: 'Прочла договор' }, NOW)
    expect(next).toMatchObject({ status: 'selected', recipients: 'Ира', sessionIds: ['session-1'] })
    expect(next.reveals).toEqual([expect.objectContaining({ status: 'selected', sessionId: 'session-1', note: 'Прочла договор', createdAt: NOW })])
    expect(changeSecretStatus(next, { status: 'selected', recipients: 'Ира', note: '' }, NOW)).toBe(next)
  })
})

describe('library', () => {
  const entities = [
    newEntity({ type: 'npc', name: 'Олан', tags: ['гильдия'], fields: { motive: 'месть' } }),
    newEntity({ type: 'location', name: 'Гавань' }),
    newEntity({ type: 'npc', name: 'Старый капитан', status: 'archived' }),
  ]
  it('hides archived entities unless asked and filters by type and fields', () => {
    expect(filterEntities(entities, { query: '', type: 'all', showArchived: false }).map((item) => item.name)).toEqual(['Олан', 'Гавань'])
    expect(filterEntities(entities, { query: '', type: 'npc', showArchived: true }).map((item) => item.name)).toEqual(['Олан', 'Старый капитан'])
    expect(filterEntities(entities, { query: 'месть', type: 'all', showArchived: false }).map((item) => item.name)).toEqual(['Олан'])
  })
})

describe('stage 1 migration', () => {
  it('fills new fields for campaigns saved before them', () => {
    const campaign = normalizeCampaign({
      id: 'old', name: 'Старая', notes: [],
      entities: [{ id: 'e1', type: 'npc', name: 'Олан', description: '', tags: ['из сессии'] }],
      storyArcs: [{ id: 'a1', title: 'Линия', direction: '', stakes: '', status: 'active', progress: 10 }],
      clocks: [{ id: 'c1', title: 'Часы', kind: 'threat', value: 1, segments: 6, visibility: 'master', trigger: '', history: [] }],
      secrets: [{ id: 's1', title: 'Секрет', truth: 'Правда', publicVersion: '', recipients: '', status: 'hidden' }],
      sessionRecords: [{ id: 'session-1', title: 'Старт', planItems: [] }],
    }, NOW)!
    expect(campaign.entities[0]).toMatchObject({ fields: {}, visibility: 'master', status: 'active', origin: { kind: 'plan' } })
    expect(campaign.storyArcs[0]).toMatchObject({ statusReason: '', owner: '', mode: 'foreground' })
    expect(campaign.clocks[0]).toMatchObject({ thresholds: [], triggerStatus: 'idle', arcId: '', entityIds: [], secretIds: [] })
    expect(campaign.secrets[0]).toMatchObject({ revealCondition: '', entityIds: [], clockIds: [], sessionIds: [], reveals: [] })
    expect(campaign.sessionRecords[0].backgroundArcIds).toEqual([])
  })
})

describe('entity usages', () => {
  it('finds plan references in future and trashed sessions, with their scene, plus relations, clocks and secrets', () => {
    const base = normalizeCampaign({ id: 'c', name: 'Кампания' }, NOW)!
    const item = (id: string, patch = {}) => ({ id, source: 'text' as const, text: id, kind: 'scene' as const, priority: 'required' as const, status: 'prepared' as const, role: '', alternative: '', note: '', origin: 'prepared' as const, ...patch })
    const first = { ...blankSession(1, 'm', NOW, 's1'), title: 'Первая', deletedAt: NOW, planItems: [item('gate', { text: 'Ворота' }), item('cap-1', { source: 'library', entityId: 'captain', sceneId: 'gate' })] }
    const future = { ...blankSession(2, 'm', NOW, 's2'), title: 'Будущая', planItems: [item('cap-2', { source: 'library', entityId: 'captain' })] }
    const campaign = {
      ...withLocalSessions(base, [first, future]),
      entities: [newEntity({ id: 'captain', type: 'npc', name: 'Капитан' }), newEntity({ id: 'guild', type: 'faction', name: 'Гильдия' })],
      relations: [{ id: 'r', fromId: 'guild', toId: 'captain', label: 'платит', type: 'debt' as const, direction: 'directed' as const, visibility: 'master' as const }],
      clocks: [newClock({ id: 'k', title: 'Бунт', entityIds: ['captain'] })],
      secrets: [newSecret({ id: 'x', title: 'Долг', entityIds: ['guild'] })],
    }
    const usages = entityUsages(campaign, 'captain')
    expect(usages.plans).toEqual([
      { sessionId: 's1', sessionNumber: 1, sessionTitle: 'Первая', itemId: 'cap-1', sceneTitle: 'Ворота', trashed: true },
      { sessionId: 's2', sessionNumber: 2, sessionTitle: 'Будущая', itemId: 'cap-2', sceneTitle: undefined, trashed: false },
    ])
    expect(usages.relations.map((relation) => relation.id)).toEqual(['r'])
    expect(usages.clocks.map((clock) => clock.id)).toEqual(['k'])
    expect(usages.secrets).toEqual([])
    expect(usageCount(usages)).toBe(4)
    expect(usageCount(entityUsages(campaign, 'nobody'))).toBe(0)
  })
})

describe('NPC fate', () => {
  it('filters NPCs by alive or dead and ignores the flag on other types', () => {
    const entities = [newEntity({ type: 'npc', name: 'Живой' }), newEntity({ type: 'npc', name: 'Мёртвый', dead: true }), newEntity({ type: 'location', name: 'Гавань' })]
    const names = (fate: 'all' | 'alive' | 'dead') => filterEntities(entities, { query: '', type: 'npc', showArchived: false, fate }).map((item) => item.name)
    expect(names('all')).toEqual(['Живой', 'Мёртвый'])
    expect(names('alive')).toEqual(['Живой'])
    expect(names('dead')).toEqual(['Мёртвый'])
  })

  it('keeps the flag through a reload only for NPCs', () => {
    const campaign = normalizeCampaign({ id: 'c', name: 'К', entities: [{ id: 'a', type: 'npc', name: 'A', dead: true }, { id: 'b', type: 'location', name: 'B', dead: true }, { id: 'c', type: 'npc', name: 'C', dead: 'yes' }] }, NOW)!
    expect(campaign.entities.map((entity) => entity.dead)).toEqual([true, undefined, undefined])
  })
})
