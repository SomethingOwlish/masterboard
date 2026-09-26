import { describe, expect, it } from 'vitest'
import { FakeBridge, LOREBOOK, LOVEGAME } from '../test/fakeBridge'
import { newEntity } from './domain'
import { normalizeCampaign } from './normalize'
import { confirmSelected, enqueue, previewDrafts, reasonLabel, retrySelected, sendConfirmed } from './publishing'

const NOW = '2026-09-26T10:00:00.000Z'

function campaign() {
  const base = normalizeCampaign({ id: 'c', name: 'К', notes: [], integrations: { lorebook: { externalId: 'w-port', label: 'Лунный порт' }, lovegame: { externalId: 'c-lanterns', label: 'Фонари' } } }, NOW)!
  const entities = [
    newEntity({ id: 'npc', type: 'npc', name: 'Олан', description: 'Фонарщик', fields: { motive: 'Искупление' } }),
    newEntity({ id: 'item', type: 'item', name: 'Ключ' }),
    newEntity({ id: 'map', type: 'map', name: 'Карта порта', visibility: 'public' }),
  ]
  let next = { ...base, entities }
  next = enqueue(next, 'npc', LOREBOOK, 'create', NOW, 'character')
  next = enqueue(next, 'item', LOREBOOK, 'create', NOW, 'item')
  next = enqueue(next, 'map', LOVEGAME, 'create', NOW, 'handout')
  return next
}

describe('batch publishing through lorebridge', () => {
  it('sends card fields by their label and checks drafts by the type on the other side', async () => {
    const queued = campaign()
    expect(queued.publications[0]).toMatchObject({ state: 'draft', entityType: 'npc', targetType: 'character', patch: { name: 'Олан', summary: 'Фонарщик', fields: { 'Мотив': 'Искупление' }, visibility: 'master' } })
    const checked = await previewDrafts(queued, new FakeBridge())
    expect(checked.publications.map((item) => item.state)).toEqual(['ready', 'blocked', 'ready'])
    expect(checked.publications[1].entityType).toBe('item')
    expect(reasonLabel(checked.publications[1].error)).toBe('Это назначение не принимает такой тип сущности')
  })

  it('sends only confirmed items, remembers where each record went, and retries failures', async () => {
    const bridge = new FakeBridge()
    const checked = await previewDrafts(campaign(), bridge)
    const ids = checked.publications.map((item) => item.id)
    const confirmed = confirmSelected(checked, [ids[0], ids[2]], NOW)
    await expect(sendConfirmed(checked, bridge, NOW)).rejects.toThrow('Нет подтверждённых')
    bridge.failing.add(LOVEGAME)
    const { campaign: sent, succeeded, failed } = await sendConfirmed(confirmed, bridge, NOW)
    expect([succeeded, failed]).toEqual([1, 1])
    expect(sent.publications.map((item) => item.state)).toEqual(['succeeded', 'blocked', 'failed'])
    expect(sent.publications[2].error).toBe('Лорбук: база не ответила')
    expect(sent.entities[0].sources).toEqual([expect.objectContaining({ system: 'lorebook', containerId: 'w-port', id: 'ext-1', type: 'character', snapshot: expect.objectContaining({ name: 'Олан' }) })])
    bridge.failing.clear()
    const retried = retrySelected(sent, [ids[2]], NOW)
    const again = await sendConfirmed(retried, bridge, NOW)
    expect(again.campaign.publications.map((item) => item.state)).toEqual(['succeeded', 'blocked', 'succeeded'])
    expect(again.campaign.entities[2].sources[0]).toMatchObject({ system: 'lovegame', type: 'handout' })
  })

  it('updates the linked record next time and refuses a stale write with 409', async () => {
    const bridge = new FakeBridge()
    const drafts = await previewDrafts(campaign(), bridge)
    const first = await sendConfirmed(confirmSelected(drafts, [drafts.publications[0].id], NOW), bridge, NOW)
    const renamed = { ...first.campaign, publications: [], entities: first.campaign.entities.map((entity) => entity.id === 'npc' ? { ...entity, name: 'Олан-фонарщик' } : entity) }
    const queued = enqueue(renamed, 'npc', LOREBOOK, 'create', NOW)
    expect(queued.publications[0]).toMatchObject({ operation: 'update', targetType: 'character' })
    const checked = await previewDrafts(queued, bridge)
    const ready = confirmSelected(checked, [checked.publications[0].id], NOW)
    bridge.editThere(LOREBOOK, 'ext-1', { summary: 'Правка в Лорбуке' })
    const stale = await sendConfirmed(ready, bridge, NOW)
    expect(stale.failed).toBe(1)
    expect(bridge.sent.at(-1)).toMatchObject({ operation: 'update', target: { entityId: 'ext-1' } })
  })
})
