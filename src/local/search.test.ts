import { describe, expect, it } from 'vitest'
import { EMPTY_FILTER, filterEntities, newArc, newClock, newEntity, newSecret } from './domain'
import { blankSession, normalizeCampaign, withLocalSessions } from './normalize'
import { searchCampaign } from './search'

const NOW = '2026-09-27T12:00:00.000Z'
const campaign = () => {
  const base = normalizeCampaign({
    id: 'c', name: 'К',
    entities: [newEntity({ id: 'olan', type: 'npc', name: 'Смотритель Олан', description: 'Помнит договор с луной', tags: ['гильдия'] }), newEntity({ id: 'port', type: 'location', name: 'Гавань', tags: ['порт'], sources: [] })],
    secrets: [newSecret({ id: 's', title: 'Цена договора', truth: 'Луна забирает имена' })],
    clocks: [newClock({ id: 'k', title: 'Красный прилив' })],
    storyArcs: [newArc({ id: 'a', title: 'Договор с луной' })],
    players: [{ id: 'p', name: 'Ира', characterIds: [], note: 'любит интриги' }],
  }, NOW)!
  const session = { ...blankSession(1, base.masters[0].id, NOW), id: 'x', title: 'Первая ночь', planItems: [] }
  return withLocalSessions(base, [{ ...session, planItems: [{ id: 'i', source: 'text' as const, text: 'Встреча в гавани', kind: 'scene' as const, priority: 'required' as const, status: 'prepared' as const, role: '', alternative: '', note: '', origin: 'prepared' as const }] }])
}

describe('campaign search (ТЗ-2, R5 B)', () => {
  it('finds every word across record types, grouped, the library first', () => {
    const hits = searchCampaign(campaign(), 'договор')
    expect(hits.map((hit) => [hit.kind, hit.title])).toEqual([['entity', 'Смотритель Олан'], ['secret', 'Цена договора'], ['arc', 'Договор с луной']])
  })
  it('opens a plan item through its session and ignores ё', () => {
    expect(searchCampaign(campaign(), 'встреча гавани')).toEqual([expect.objectContaining({ kind: 'plan', target: { kind: 'session', id: 'x' } })])
    expect(searchCampaign(campaign(), 'интриги')[0]).toMatchObject({ kind: 'player', id: 'p' })
    expect(searchCampaign(campaign(), '   ')).toEqual([])
  })
})

describe('library filters (ТЗ-2, R5 A)', () => {
  it('searches the description, filters by tag and source, sorts by name', () => {
    const { entities } = campaign()
    expect(filterEntities(entities, { ...EMPTY_FILTER, query: 'луной' }).map((entity) => entity.id)).toEqual(['olan'])
    expect(filterEntities(entities, { ...EMPTY_FILTER, tags: ['порт'] }).map((entity) => entity.id)).toEqual(['port'])
    expect(filterEntities(entities, { ...EMPTY_FILTER, source: 'lorebook' })).toEqual([])
    expect(filterEntities(entities, { ...EMPTY_FILTER, source: 'none' })).toHaveLength(2)
    expect(filterEntities(entities, { ...EMPTY_FILTER, sort: 'name' }).map((entity) => entity.name)).toEqual(['Гавань', 'Смотритель Олан'])
  })
})
