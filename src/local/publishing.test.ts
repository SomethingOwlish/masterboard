import { describe, expect, it } from 'vitest'
import { newEntity } from './domain'
import { normalizeCampaign } from './normalize'
import { confirmSelected, enqueue, fakeGateway, previewDrafts, reasonLabel, retrySelected, sendConfirmed } from './publishing'

const NOW = '2026-09-26T10:00:00.000Z'

function campaign() {
  const base = normalizeCampaign({ id: 'c', name: 'К', notes: [] }, NOW)!
  const entities = [
    newEntity({ id: 'npc', type: 'npc', name: 'Олан', description: 'Фонарщик', fields: { motive: 'Искупление' } }),
    newEntity({ id: 'item', type: 'item', name: 'Ключ' }),
    newEntity({ id: 'map', type: 'map', name: 'Карта порта', visibility: 'public' }),
  ]
  let next = { ...base, entities }
  next = enqueue(next, 'npc', 'fake-lorebook', 'create', NOW)
  next = enqueue(next, 'item', 'fake-lorebook', 'create', NOW)
  next = enqueue(next, 'map', 'fake-lovegame', 'create', NOW)
  return next
}

describe('batch publishing on fake destinations', () => {
  it('builds a patch from the entity and checks drafts independently', async () => {
    const queued = campaign()
    expect(queued.publications[0]).toMatchObject({ state: 'draft', entityType: 'npc', patch: { name: 'Олан', description: 'Фонарщик', motive: 'Искупление' } })
    const checked = await previewDrafts(queued, fakeGateway(queued.publications))
    expect(checked.publications.map((item) => item.state)).toEqual(['ready', 'blocked', 'ready'])
    expect(reasonLabel(checked.publications[1].error)).toBe('Лорбук пока не принимает предметы')
  })

  it('sends only confirmed items, keeps each result, and retries failures', async () => {
    const checked = await previewDrafts(campaign(), fakeGateway([]))
    const ids = checked.publications.map((item) => item.id)
    const confirmed = confirmSelected(checked, [ids[0], ids[2]], NOW)
    await expect(sendConfirmed(checked, fakeGateway(checked.publications), NOW)).rejects.toThrow('Нет подтверждённых')
    const { campaign: sent, succeeded, failed } = await sendConfirmed(confirmed, fakeGateway(confirmed.publications, new Set(['fake-lovegame'])), NOW)
    expect([succeeded, failed]).toEqual([1, 1])
    expect(sent.publications.map((item) => item.state)).toEqual(['succeeded', 'blocked', 'failed'])
    expect(reasonLabel(sent.publications[2].error)).toBe('Назначение не ответило (имитация сбоя)')
    const retried = retrySelected(sent, [ids[2]], NOW)
    expect(retried.publications[2]).toMatchObject({ state: 'ready', error: undefined })
    const again = await sendConfirmed(retried, fakeGateway(retried.publications), NOW)
    expect(again.campaign.publications.map((item) => item.state)).toEqual(['succeeded', 'blocked', 'succeeded'])
  })
})
