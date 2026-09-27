import { describe, expect, it } from 'vitest'
import { newEntity, newSecret } from './domain'
import { normalizeCampaign } from './normalize'
import { applySessionImport, parseSessionImport, sessionImportTemplate, splitTitle } from './sessionImport'

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

  it('splits paragraphs written as titles into a title and a note', () => {
    expect(splitTitle('Пристань', 'scene')).toEqual({ title: 'Пристань', rest: '' })
    expect(splitTitle('ПОРОГ 1 · ВОДА. Внутри закрывающегося разлома: не глубина, а вес. Мимо идёт что-то длиной с платформу.', 'scene'))
      .toEqual({ title: 'ПОРОГ 1 · ВОДА', rest: 'Внутри закрывающегося разлома: не глубина, а вес. Мимо идёт что-то длиной с платформу.' })
    expect(splitTitle('Сверит ли Стиг почерк Лейфа с конвертом, который он уже видел? Подсказку не давать — это награда.', 'question').title).toBe('Сверит ли Стиг почерк Лейфа с конвертом, который он уже видел?')
    expect(splitTitle('Сага — хроникёр корпорации [?] земное имя', 'npc')).toEqual({ title: 'Сага', rest: 'Хроникёр корпорации [?] земное имя' })
    expect(splitTitle('Сага — хроникёр', 'note')).toEqual({ title: 'Сага — хроникёр', rest: '' })
    const unbroken = 'слово '.repeat(30).trim()
    expect(splitTitle(unbroken, 'note')).toMatchObject({ title: expect.stringMatching(/…$/), rest: unbroken })
  })

  it('keeps transitions working when a long scene title was split, and says so', () => {
    const long = 'ПОРОГ 1 · ВОДА. Внутри закрывающегося разлома: не глубина, а вес, и мимо идёт что-то длиной с платформу.'
    const file = JSON.stringify([{ title: 'А', scenes: [{ title: 'Мост' }, { title: long, note: 'Коротко' }], transitions: [{ from: 'Мост', to: long }] }])
    const { sessions, warnings } = parseSessionImport(file, base(), 'm', NOW)
    const scene = sessions[0].planItems[1]
    expect(scene).toMatchObject({ text: 'ПОРОГ 1 · ВОДА', note: expect.stringMatching(/^Внутри закрывающегося.*\n\nКоротко$/s) })
    expect(sessions[0].flows).toEqual([expect.objectContaining({ toItemId: scene.id })])
    expect(warnings).toEqual(['«А»: длинные названия (1) разделены на название и заметку — проверьте их'])
  })

  it('rejects files that are not JSON or hold no sessions', () => {
    expect(() => parseSessionImport('{', base(), 'm', NOW)).toThrow(/JSON/)
    expect(() => parseSessionImport('{"sessions": []}', base(), 'm', NOW)).toThrow(/ни одной/)
    expect(() => parseSessionImport('{"format": "other/v1", "sessions": [{}]}', base(), 'm', NOW)).toThrow(/формат/)
  })
})
