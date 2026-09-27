import { describe, expect, it } from 'vitest'
import { FakeBridge, LOREBOOK, LOVEGAME } from '../test/fakeBridge'
import { newEntity } from './domain'
import { normalizeCampaign } from './normalize'
import { UNLINKED_REASON, checkedLink, linkOf, withLink } from './integration'
import { confirmSelected, enqueue, pickHint, previewDrafts, reasonLabel, removeQueued, retrySelected, sendConfirmed, unconfirm } from './publishing'

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

  it('blocks the queue for an unlinked world, keeps it blocked on check, and never sends it', async () => {
    const bridge = new FakeBridge()
    const checked = await previewDrafts(campaign(), bridge)
    const confirmed = confirmSelected(checked, checked.publications.map((item) => item.id), NOW)
    const unlinked = withLink(confirmed, 'lorebook', null)
    expect(unlinked.publications.map((item) => [item.state, item.confirmedAt])).toEqual([['blocked', undefined], ['blocked', undefined], ['ready', NOW]])
    expect(unlinked.publications[0].error).toBe(UNLINKED_REASON)
    expect(pickHint(unlinked.publications[0])).toContain('Подключение отвязано')

    const rechecked = await previewDrafts(unlinked, bridge)
    expect(rechecked.publications.slice(0, 2).map((item) => [item.state, item.error])).toEqual([['blocked', UNLINKED_REASON], ['blocked', UNLINKED_REASON]])
    const sent = await sendConfirmed(unlinked, bridge, NOW)
    expect(bridge.sent.map((item) => item.connectionId)).toEqual([LOVEGAME])
    expect(sent.succeeded).toBe(1)
  })

  it('blocks at send time a confirmed item whose place was unlinked elsewhere (a co-master, an old copy)', async () => {
    const bridge = new FakeBridge()
    const checked = await previewDrafts(campaign(), bridge)
    const confirmed = confirmSelected(checked, [checked.publications[0].id], NOW)
    const stale = { ...confirmed, integrations: { lovegame: confirmed.integrations.lovegame } }
    const result = await sendConfirmed(stale, bridge, NOW)
    expect(bridge.sent).toEqual([])
    expect(result).toMatchObject({ succeeded: 0, failed: 0, blocked: 1 })
    expect(result.campaign.publications[0]).toMatchObject({ state: 'blocked', error: UNLINKED_REASON })
  })

  it('switching the table blocks what waited for the old one', () => {
    const queued = campaign()
    const kk9 = withLink(queued, 'kk9', linkOf({ system: 'kk9', externalId: 'k-1', label: 'Стол КК9' }))
    expect(kk9.integrations.lovegame).toBeUndefined()
    expect(kk9.publications.map((item) => item.state)).toEqual(['draft', 'draft', 'blocked'])
  })

  it('lets stuck items out: a failed one can be removed, a confirmed one goes back to «готово»', async () => {
    const bridge = new FakeBridge()
    bridge.failing.add(LOREBOOK)
    const checked = await previewDrafts(campaign(), bridge)
    const ids = checked.publications.map((item) => item.id)
    const confirmed = confirmSelected(checked, [ids[0], ids[2]], NOW)
    expect(unconfirm(confirmed, ids[2]).publications[2]).toMatchObject({ state: 'ready', confirmedAt: undefined })
    const { campaign: sent } = await sendConfirmed(confirmed, bridge, NOW)
    expect(sent.publications[0].state).toBe('failed')
    expect(removeQueued(sent, ids[0]).publications.map((item) => item.id)).toEqual([ids[1], ids[2]])
    expect(removeQueued(sent, ids[2]).publications).toHaveLength(3)
    expect(pickHint(checked.publications[1])).toMatch(/^Заблокировано: Это назначение не принимает/)
    expect(pickHint(campaign().publications[0])).toBe('Сначала проверьте черновики — шаг 1')
  })

  it('keeps the result of a connection check, failed or passed', () => {
    const link = checkedLink({ externalId: 'w-port', label: 'Лунный порт' }, NOW, 'Не отвечает')
    expect(link).toEqual({ externalId: 'w-port', label: 'Лунный порт', checkedAt: NOW, checkError: 'Не отвечает' })
    expect(checkedLink(link, NOW)).toEqual({ externalId: 'w-port', label: 'Лунный порт', checkedAt: NOW })
    const stored = normalizeCampaign({ id: 'c', name: 'К', integrations: { lorebook: link } }, NOW)!
    expect(stored.integrations.lorebook).toMatchObject({ checkedAt: NOW, checkError: 'Не отвечает' })
  })
})
