import { describe, expect, it } from 'vitest'
import { changeSecretStatus, filterEntities, moveClock, newClock, newEntity, newSecret, resolveClockTrigger } from './domain'
import { normalizeCampaign } from './normalize'

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
