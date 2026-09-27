import { describe, expect, it } from 'vitest'
import { addTags, addToPlan, baseFields, exportEntities, relateTo, removeTags, sendTo, setField, setType } from './bulk'
import { newEntity } from './domain'
import { withLink } from './integration'
import { blankSession, normalizeCampaign, withLocalSessions } from './normalize'

const NOW = '2026-09-27T12:00:00.000Z'
const source = { system: 'kk9' as const, containerId: 'k-1', id: 'r1', type: 'npc-light', updatedAt: 1, syncedAt: NOW, snapshot: { name: '', description: '', tags: [], fields: {}, visibility: 'master' as const } }
const campaign = () => normalizeCampaign({ id: 'c', name: 'К', entities: [
  newEntity({ id: 'a', type: 'npc', name: 'Олан', tags: ['гильдия'], fields: { motive: 'Искупление', 'Ранг': '2' }, sources: [source] }),
  newEntity({ id: 'b', type: 'npc', name: 'Мирта', dead: true }),
  newEntity({ id: 'c', type: 'location', name: 'Гавань' }),
] }, NOW)!

describe('bulk actions (ТЗ-2, R7)', () => {
  it('adds and removes tags on many at once, without doubles', () => {
    const tagged = addTags(campaign(), ['a', 'b'], ['#Гильдия', ' порт '])
    expect(tagged.entities.map((entity) => entity.tags)).toEqual([['гильдия', 'порт'], ['гильдия', 'порт'], []])
    expect(removeTags(tagged, ['a'], ['гильдия']).entities[0].tags).toEqual(['порт'])
  })

  it('changes the type keeping field values under matching slots or labels', () => {
    const [olan, mirta] = setType(campaign(), ['a', 'b'], 'character').entities
    expect(olan).toMatchObject({ type: 'character', fields: { 'Мотив': 'Искупление', 'Ранг': '2' } })
    expect(mirta.dead).toBeUndefined()
    expect(setField(campaign(), ['a', 'c'], 'Ранг', '').entities[0].fields).toEqual({ motive: 'Искупление' })
  })

  it('puts records into a plan once and relates them to one target', () => {
    const base = campaign()
    const withSession = withLocalSessions(base, [{ ...blankSession(1, base.masters[0].id, NOW), id: 's' }])
    const planned = addToPlan(addToPlan(withSession, ['a', 'c'], 's'), ['a'], 's')
    expect(planned.sessionRecords[0].planItems.map((item) => [item.entityId, item.kind])).toEqual([['a', 'npc'], ['c', 'note']])
    const related = relateTo(relateTo(base, ['a', 'b', 'c'], 'c', 'belongs', 'живёт'), ['a'], 'c', 'belongs', '')
    expect(related.relations.map((relation) => [relation.fromId, relation.toId, relation.label])).toEqual([['a', 'c', 'живёт'], ['b', 'c', 'живёт']])
  })

  it('sends to chosen places and exports with inner relations', () => {
    const linked = withLink(campaign(), 'lorebook', { externalId: 'w', label: 'Мир' })
    const sent = sendTo(linked, ['a', 'c'], ['world'], NOW)
    expect(sent.entities.filter((entity) => entity.destinations).map((entity) => entity.id)).toEqual(['a', 'c'])
    expect(sent.publications.map((item) => item.entityId)).toEqual(['a', 'c'])
    const file = JSON.parse(exportEntities(relateTo(campaign(), ['a'], 'c', 'kin', ''), ['a', 'c'], NOW))
    expect(file.entities.map((entity: { name: string }) => entity.name)).toEqual(['Олан', 'Гавань'])
    expect(file.relations).toHaveLength(1)
  })
})

describe('fields from the base (ТЗ-2, R2)', () => {
  it('offers labels seen on records from a linked source and the schema, not the type’s own', () => {
    const linked = withLink(campaign(), 'kk9', { externalId: 'k-1', label: 'Стол' })
    expect(baseFields(linked, 'npc').map((field) => [field.label, field.from])).toEqual([['Ранг', 'kk9']])
    expect(baseFields(campaign(), 'npc')).toEqual([])
    expect(baseFields(linked, 'npc', [{ label: 'Мотив', from: 'systemsetup' }, { label: 'Биография', from: 'systemsetup' }]).map((field) => [field.label, field.long])).toEqual([['Биография', true], ['Ранг', false]])
  })
})
