import { describe, expect, it } from 'vitest'
import { applyMine, conflictPlace, conflictValue, mergeCampaign } from './merge'

const base = {
  name: 'Лунный порт', activeTime: 'Полночь',
  entities: [{ id: 'e1', name: 'Смотритель', tags: ['порт'] }, { id: 'e2', name: 'Контрабандист', tags: [] }],
  clocks: [{ id: 'k1', label: 'Шторм', filled: 1 }],
}

describe('mergeCampaign', () => {
  it('combines edits to different fields and different list items', () => {
    const mine = { ...base, name: 'Порт под луной', entities: [{ ...base.entities[0], name: 'Старый смотритель' }, base.entities[1]] }
    const theirs = { ...base, activeTime: 'Рассвет', entities: [base.entities[0], { ...base.entities[1], tags: ['берег'] }], clocks: [{ ...base.clocks[0], filled: 2 }] }
    const { merged, conflicts } = mergeCampaign(base, mine, theirs)
    expect(conflicts).toEqual([])
    expect(merged).toEqual({
      name: 'Порт под луной', activeTime: 'Рассвет',
      entities: [{ id: 'e1', name: 'Старый смотритель', tags: ['порт'] }, { id: 'e2', name: 'Контрабандист', tags: ['берег'] }],
      clocks: [{ id: 'k1', label: 'Шторм', filled: 2 }],
    })
  })

  it('keeps items added on both sides and deletions from either side', () => {
    const mine = { ...base, entities: [base.entities[0], { id: 'e3', name: 'Моя находка', tags: [] }] }
    const theirs = { ...base, entities: [...base.entities, { id: 'e4', name: 'Их находка', tags: [] }] }
    const { merged, conflicts } = mergeCampaign(base, mine, theirs)
    expect(conflicts).toEqual([])
    expect(merged.entities.map((item) => item.id)).toEqual(['e1', 'e4', 'e3'])
  })

  it('keeps the server value on a real clash and reports where it happened', () => {
    const mine = { ...base, entities: [{ ...base.entities[0], name: 'Мой смотритель' }, base.entities[1]] }
    const theirs = { ...base, entities: [{ ...base.entities[0], name: 'Их смотритель' }, base.entities[1]] }
    const { merged, conflicts } = mergeCampaign(base, mine, theirs)
    expect(merged.entities[0].name).toBe('Их смотритель')
    expect(conflicts).toEqual([{ path: 'entities[e1].name', mine: 'Мой смотритель', theirs: 'Их смотритель' }])
  })

  it('treats the same change on both sides as no clash', () => {
    const edit = { ...base, name: 'Одинаково' }
    expect(mergeCampaign(base, edit, { ...edit })).toEqual({ merged: edit, conflicts: [] })
  })

  it('puts «my» value back at the conflict path, including a deleted or restored list item', () => {
    const npc = { id: 'e1', type: 'npc', name: 'Смотритель', fields: { motive: 'мстит гильдии' } }
    const theirs = { ...base, entities: [npc, base.entities[1]] }
    const edited = applyMine(theirs, { path: 'entities[e1].fields.motive', mine: 'ищет дочь', theirs: 'мстит гильдии' })
    expect(edited.entities[0]).toEqual({ ...npc, fields: { motive: 'ищет дочь' } })
    expect(npc.fields.motive).toBe('мстит гильдии')
    expect(applyMine(theirs, { path: 'entities[e2]', mine: undefined, theirs: base.entities[1] }).entities.map((item) => item.id)).toEqual(['e1'])
    const restored = applyMine({ ...base, entities: [npc] }, { path: 'entities[e2]', mine: base.entities[1], theirs: undefined })
    expect(restored.entities.map((item) => item.id)).toEqual(['e1', 'e2'])
    expect(applyMine(base, { path: 'activeTime', mine: undefined, theirs: 'Полночь' })).not.toHaveProperty('activeTime')
  })

  it('names the place and the values of a conflict in words', () => {
    const campaign = { ...base, entities: [{ id: 'e1', type: 'npc', name: 'Старый смотритель', fields: { motive: 'x' } }], sessionRecords: [{ id: 's3', number: 3, title: 'Шторм', inGameTime: '' }] }
    expect(conflictPlace(campaign, { path: 'entities[e1].fields.motive', mine: 'a', theirs: 'b' })).toBe('Библиотека › Старый смотритель › мотив')
    expect(conflictPlace(campaign, { path: 'sessionRecords[s3].inGameTime', mine: 'a', theirs: 'b' })).toBe('Сессии › №3 Шторм › игровое время')
    expect(conflictPlace(campaign, { path: 'clocks[gone]', mine: { id: 'gone', label: 'Облава' }, theirs: undefined })).toBe('Часы › Облава')
    expect(conflictPlace(campaign, { path: '(документ)', mine: {}, theirs: {} })).toBe('Вся кампания')
    expect([conflictValue(undefined), conflictValue(''), conflictValue(['порт', 'берег']), conflictValue({ id: 'k', label: 'Облава' }), conflictValue(true)]).toEqual(['удалено', '(пусто)', 'порт · берег', 'Облава', 'да'])
    expect(conflictValue(['общий', 'мой'], ['общий', 'их'])).toBe('мой')
    expect(conflictValue(['общий'], ['общий', 'их'])).toBe('без пунктов другой версии')
  })
})
