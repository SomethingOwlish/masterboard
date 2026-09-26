import { describe, expect, it } from 'vitest'
import { mergeCampaign } from './merge'

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
})
