import { describe, expect, it } from 'vitest'
import { FakeBridge, LOREBOOK, LOVEGAME } from '../test/fakeBridge'
import { importItems, patchFor, planRefresh, resolveRefresh, targetTypes } from './integration'
import { normalizeCampaign } from './normalize'

const NOW = '2026-09-26T10:00:00.000Z'
const empty = () => normalizeCampaign({ id: 'c', name: 'К', notes: [] }, NOW)!

async function imported() {
  const bridge = new FakeBridge()
  bridge.seed(LOREBOOK, { id: 'e1', type: 'character', name: 'Смотритель маяка', summary: 'Следит за огнём.', tags: ['Порт'], fields: { 'Роль в истории': 'свидетель', 'Где живёт': 'маяк' } })
  bridge.seed(LOREBOOK, { id: 'e2', type: 'event', name: 'Осада', archived: true, status: 'archived' })
  const { campaign, added } = importItems(empty(), 'lorebook', 'w-port', await bridge.entities(LOREBOOK), NOW)
  return { bridge, campaign, added }
}

describe('import from lorebook / lovegame (F2)', () => {
  it('copies chosen records into the library with a link to the source', async () => {
    const { campaign, added } = await imported()
    expect(added).toBe(2)
    const [keeper, siege] = campaign.entities
    expect(keeper).toMatchObject({ type: 'npc', name: 'Смотритель маяка', description: 'Следит за огнём.', tags: ['порт'], visibility: 'public', origin: { kind: 'import' }, fields: { role: 'свидетель', 'Где живёт': 'маяк' } })
    expect(keeper.sources[0]).toMatchObject({ system: 'lorebook', containerId: 'w-port', id: 'e1', type: 'character' })
    expect(siege).toMatchObject({ type: 'note', status: 'archived' })
  })

  it('does not import the same record twice and sends unknown fields back under their own label', async () => {
    const { bridge, campaign } = await imported()
    expect(importItems(campaign, 'lorebook', 'w-port', await bridge.entities(LOREBOOK), NOW).added).toBe(0)
    expect(patchFor(campaign.entities[0], 'update').fields).toEqual({ 'Роль в истории': 'свидетель', 'Где живёт': 'маяк' })
  })
})

describe('refresh from source (I4)', () => {
  it('takes what only the source changed and keeps what only Masterboard changed', async () => {
    const { bridge, campaign } = await imported()
    const entity = { ...campaign.entities[0], name: 'Старый смотритель' }
    const item = bridge.editThere(LOREBOOK, 'e1', { summary: 'Следит за огнём и за кораблями.' })
    const plan = planRefresh(entity, entity.sources[0], item, NOW)
    expect(plan.clashes).toEqual([])
    expect(plan.changed).toEqual(['Описание'])
    expect(plan.next).toMatchObject({ name: 'Старый смотритель', description: 'Следит за огнём и за кораблями.' })
    expect(plan.next.sources[0]).toMatchObject({ updatedAt: item.updatedAt, snapshot: { description: 'Следит за огнём и за кораблями.' } })
  })

  it('shows a clash when both changed the same field and applies the master\'s choice', async () => {
    const { bridge, campaign } = await imported()
    const entity = { ...campaign.entities[0], fields: { ...campaign.entities[0].fields, role: 'соучастник' } }
    const item = bridge.editThere(LOREBOOK, 'e1', { fields: { 'Роль в истории': 'жертва', 'Где живёт': 'маяк' } })
    const plan = planRefresh(entity, entity.sources[0], item, NOW)
    expect(plan.clashes).toEqual([{ key: 'fields.role', label: 'Роль в истории', mine: 'соучастник', theirs: 'жертва' }])
    expect(resolveRefresh(plan, {}).fields.role).toBe('жертва')
    expect(resolveRefresh(plan, { 'fields.role': 'mine' }).fields.role).toBe('соучастник')
  })

  it('archives the entity when the source archived the record', async () => {
    const { bridge, campaign } = await imported()
    const item = bridge.editThere(LOREBOOK, 'e1', { archived: true, status: 'archived' })
    expect(planRefresh(campaign.entities[0], campaign.entities[0].sources[0], item, NOW).next.status).toBe('archived')
  })
})

describe('type table (F3)', () => {
  it('puts the default type first among what the destination accepts', async () => {
    const bridge = new FakeBridge()
    expect(targetTypes(await bridge.getPassport(LOREBOOK), 'lorebook', 'npc').map((item) => item.id)).toEqual(['character', 'location', 'faction', 'lore'])
    expect(targetTypes(await bridge.getPassport(LOVEGAME), 'lovegame', 'letter')[0].id).toBe('handout')
    expect(targetTypes(undefined, 'lovegame', 'faction')).toEqual([{ id: 'codex', label: 'codex' }])
  })
})
