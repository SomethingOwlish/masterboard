import { describe, expect, it } from 'vitest'
import { newEntity, newSecret } from './domain'
import { normalizeCampaign } from './normalize'
import { applySessionImport, parseSessionImport, sessionImportTemplate } from './sessionImport'

const NOW = '2026-09-27T10:00:00.000Z'
const base = () => normalizeCampaign({ id: 'c', name: 'Кампания', sessionRecords: [{ id: 's1', number: 3, title: 'Была' }] }, NOW)!

describe('session import', () => {
  it('turns the downloadable template into a draft session with scenes, members and transitions', () => {
    const campaign = { ...base(), entities: [newEntity({ type: 'npc', name: 'Лодочник' })] }
    const { sessions, warnings } = parseSessionImport(sessionImportTemplate(campaign), campaign, 'm', NOW)
    expect(warnings).toEqual([])
    const [session] = sessions
    expect(session).toMatchObject({ number: 4, title: 'Ночь красного прилива', status: 'draft' })
    const scenes = session.planItems.filter((item) => item.kind === 'scene')
    expect(scenes.map((item) => item.text)).toEqual(['Пристань', 'Погоня по крышам', 'Тихий обход по каналам'])
    const members = session.planItems.filter((item) => item.sceneId === scenes[0].id)
    expect(members.map((item) => item.kind)).toEqual(['npc', 'question', 'note'])
    expect(members[0]).toMatchObject({ source: 'library', entityId: campaign.entities[0].id, text: 'Лодочник', role: 'Проводник' })
    expect(session.flows).toHaveLength(2)
    expect(session.flows[0]).toMatchObject({ fromItemId: scenes[0].id, toItemId: scenes[1].id, condition: 'Героев заметили' })
  })

  it('accepts a bare array, Russian kinds and priorities, and links secrets by title', () => {
    const campaign = { ...base(), secrets: [newSecret({ title: 'Шлюзы открыл мэр', truth: '' })] }
    const file = JSON.stringify([{ title: 'А', items: [{ kind: 'событие', text: 'Взрыв', priority: 'запас' }, { secret: 'шлюзы открыл мэр' }] }, { title: 'Б' }])
    const { sessions } = parseSessionImport(file, campaign, 'm', NOW)
    expect(sessions.map((session) => session.number)).toEqual([4, 5])
    expect(sessions[0].planItems[0]).toMatchObject({ kind: 'event', priority: 'backup', text: 'Взрыв' })
    expect(sessions[0].planItems[1]).toMatchObject({ kind: 'secret', secretId: campaign.secrets[0].id, text: 'Шлюзы открыл мэр' })
  })

  it('reports unknown names and bad dates as warnings instead of failing', () => {
    const file = JSON.stringify({ sessions: [{ title: 'А', date: '2026-02-30', master: 'Никто', scenes: [{ title: 'Сцена', items: [{ library: 'Нет такой' }] }], transitions: [{ from: 'Сцена', to: 'Пропасть' }] }] })
    const { sessions, warnings } = parseSessionImport(file, base(), 'm', NOW)
    expect(sessions[0]).toMatchObject({ date: '', masterId: 'm' })
    expect(sessions[0].planItems[1]).toMatchObject({ source: 'text', text: 'Нет такой' })
    expect(sessions[0].flows).toEqual([])
    expect(warnings).toHaveLength(4)
  })

  it('leaves template hints out of the imported session, old and new templates alike', () => {
    const { sessions } = parseSessionImport(sessionImportTemplate(base()), base(), 'm', NOW)
    expect(sessions[0]).toMatchObject({ idea: '', focus: '', opening: '', inGameTime: '' })
    expect(sessions[0].planItems[0].note).toBe('')
    const old = JSON.stringify({ sessions: [{ title: 'А', focus: 'Главный вопрос или цель', opening: 'С чего начинается игра', scenes: [{ title: 'Пристань', note: 'Что должно произойти в сцене', items: [{ kind: 'npc', library: 'Имя записи из библиотеки' }] }] }] })
    const [session] = parseSessionImport(old, base(), 'm', NOW).sessions
    expect(session).toMatchObject({ focus: '', opening: '' })
    expect(session.planItems.map((item) => [item.text, item.note])).toEqual([['Пристань', '']])
  })

  it('offers missing NPCs, materials and secrets and files them into the library and secrets on request', () => {
    const campaign = { ...base(), entities: [newEntity({ type: 'npc', name: 'Лодочник' })] }
    const file = JSON.stringify([
      { title: 'А', items: [{ kind: 'npc', text: 'Мирта', note: 'Солеварка' }, { kind: 'npc', library: 'Лодочник' }, { kind: 'material', text: 'Карта' }, { kind: 'secret', text: 'Мэр открыл шлюзы' }, { kind: 'question', text: 'Кто?' }] },
      { title: 'Б', items: [{ kind: 'нпс', text: 'мирта' }, { kind: 'secret', text: 'Мэр открыл шлюзы' }] },
    ])
    const result = parseSessionImport(file, campaign, 'm', NOW)
    expect(result.newRecords).toEqual([{ kind: 'npc', name: 'Мирта' }, { kind: 'material', name: 'Карта' }, { kind: 'secret', name: 'Мэр открыл шлюзы' }])

    const kept = applySessionImport(campaign, result, false)
    expect(kept.entities).toHaveLength(1)
    expect(kept.sessionRecords.slice(1).map((session) => session.title)).toEqual(['А', 'Б'])

    const next = applySessionImport(campaign, result, true)
    const mirta = next.entities.find((entity) => entity.name === 'Мирта')!
    expect(mirta).toMatchObject({ type: 'npc', description: 'Солеварка', origin: { kind: 'import' } })
    expect(next.entities.find((entity) => entity.name === 'Карта')).toMatchObject({ type: 'handout' })
    expect(next.secrets).toHaveLength(1)
    const [a, b] = next.sessionRecords.slice(1)
    expect(next.secrets[0].sessionIds).toEqual([a.id, b.id])
    expect(a.planItems[0]).toMatchObject({ source: 'library', entityId: mirta.id })
    expect(b.planItems[0]).toMatchObject({ source: 'library', entityId: mirta.id })
    expect(b.planItems[1]).toMatchObject({ secretId: next.secrets[0].id })
    expect(next.activeSessionId).toBe(a.id)
  })

  it('rejects files that are not JSON or hold no sessions', () => {
    expect(() => parseSessionImport('{', base(), 'm', NOW)).toThrow(/JSON/)
    expect(() => parseSessionImport('{"sessions": []}', base(), 'm', NOW)).toThrow(/ни одной/)
    expect(() => parseSessionImport('{"format": "other/v1", "sessions": [{}]}', base(), 'm', NOW)).toThrow(/формат/)
  })
})
