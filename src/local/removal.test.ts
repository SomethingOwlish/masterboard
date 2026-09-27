import { describe, expect, it } from 'vitest'
import { newArc, newClock, newEntity, newSecret } from './domain'
import { blankSession, normalizeCampaign } from './normalize'
import { arcRemovalImpact, entityRemovalImpact, groupRemovalImpact, namesList, planItemRemovalImpact, removeArc, rulesResetChanges } from './removal'
import type { LocalCampaignRecord, LocalSessionPlanItem } from './types'

const NOW = '2026-09-27T10:00:00.000Z'
const item = (id: string, text: string, patch: Partial<LocalSessionPlanItem> = {}): LocalSessionPlanItem => ({ id, source: 'text', text, kind: 'note', priority: 'desired', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared', ...patch })

function campaign(patch: Partial<LocalCampaignRecord> = {}): LocalCampaignRecord {
  return { ...normalizeCampaign({ id: 'c', name: 'Кампания', notes: [] }, NOW)!, ...patch }
}

describe('namesList', () => {
  it('quotes up to three names and counts the rest', () => {
    expect(namesList(['А'])).toBe('«А»')
    expect(namesList(['А', 'Б', 'В', 'Г', 'Д'])).toBe('«А», «Б», «В» и ещё 2')
  })
})

describe('entityRemovalImpact', () => {
  it('is empty for a record nothing points at', () => {
    expect(entityRemovalImpact(campaign({ entities: [newEntity({ id: 'e', type: 'npc', name: 'Олан' })] }), 'e')).toEqual([])
  })

  it('lists relations, clocks, secrets and players by name', () => {
    const data = campaign({
      entities: [newEntity({ id: 'e', type: 'npc', name: 'Олан' }), newEntity({ id: 'f', type: 'faction', name: 'Гильдия' })],
      relations: [{ id: 'r', fromId: 'f', toId: 'e', label: 'нанимает', type: 'other', direction: 'directed', visibility: 'master' }],
      clocks: [newClock({ id: 'k', title: 'Прилив', entityIds: ['e'] })],
      secrets: [newSecret({ id: 's', title: 'Долг', entityIds: ['e'] }), newSecret({ id: 't', title: 'Клятва', entityIds: ['e'] })],
      players: [{ id: 'p', name: 'Аня', characterIds: ['e'], note: '' }],
    })
    expect(entityRemovalImpact(data, 'e')).toEqual([
      'Связь с «Гильдия» — удалится',
      'Часы «Прилив» — отвяжутся от неё',
      'Секреты «Долг», «Клятва» — отвяжутся от неё',
      'Игрок «Аня» — больше не играет за неё',
    ])
  })
})

describe('planItemRemovalImpact', () => {
  const session = { ...blankSession(1, 'm', NOW, 's'), planItems: [item('scene', 'Порт', { kind: 'scene' }), item('a', 'Олан', { sceneId: 'scene' }), item('b', 'Ставка')], flows: [{ id: 'f', fromItemId: 'scene', toItemId: 'b', condition: '' }] }
  const titleOf = (id: string) => session.planItems.find((entry) => entry.id === id)?.text ?? ''

  it('names a scene\'s members and the transitions through it', () => {
    expect(planItemRemovalImpact(session, 'scene', titleOf)).toEqual([
      '1 пункт сцены («Олан») — останется в плане «вне сцен»',
      'Переход «Порт» → «Ставка» — удалится',
    ])
  })

  it('is empty for a lone item', () => {
    expect(planItemRemovalImpact(session, 'a', titleOf)).toEqual([])
  })
})

describe('removeArc', () => {
  it('clears the arc from sessions and clocks (ТЗ-3, этап 5)', () => {
    const data = campaign({
      storyArcs: [newArc({ id: 'arc', title: 'Луна' })],
      sessionRecords: [{ ...blankSession(1, 'm', NOW, 's1'), title: 'Первая', arcId: 'arc' }, { ...blankSession(2, 'm', NOW, 's2'), title: 'Вторая', backgroundArcIds: ['arc', 'other'] }],
      clocks: [newClock({ id: 'k', title: 'Прилив', arcId: 'arc' }), newClock({ id: 'l', title: 'Шторм', arcId: 'other' })],
    })
    expect(arcRemovalImpact(data, 'arc')).toEqual([
      'Сессия №1 «Первая» — останется без основной линии',
      'Сессия №2 «Вторая» — линия уйдёт из фоновых',
      'Часы «Прилив» — отвяжутся от линии',
    ])
    const next = removeArc(data, 'arc')
    expect(next.storyArcs).toEqual([])
    expect(next.sessionRecords.map((session) => [session.arcId, session.backgroundArcIds])).toEqual([['', []], ['', ['other']]])
    expect(next.clocks.map((clock) => clock.arcId)).toEqual(['', 'other'])
    expect(arcRemovalImpact(next, 'arc')).toEqual([])
  })
})

describe('groupRemovalImpact', () => {
  it('lists live sessions played for the group and secrets told to it', () => {
    const data = campaign({
      groups: [{ id: 'g', name: 'Основная', playerIds: [] }],
      sessionRecords: [{ ...blankSession(1, 'm', NOW, 's1'), title: 'Первая', groupId: 'g' }, { ...blankSession(2, 'm', NOW, 's2'), title: 'В корзине', groupId: 'g', deletedAt: NOW }],
      secrets: [newSecret({ id: 's', title: 'Долг', recipientIds: ['g'] })],
    })
    expect(groupRemovalImpact(data, 'g')).toEqual([
      'Сессия №1 «Первая» — останется без группы',
      'Секрет «Долг» — группа уйдёт из получателей',
    ])
  })
})

describe('rulesResetChanges', () => {
  it('lists only types whose rule differs from the default', () => {
    expect(rulesResetChanges({ publishRules: { lore: ['world'], npc: [] } })).toEqual([{ type: 'npc', from: [], to: ['table'] }])
  })
})
