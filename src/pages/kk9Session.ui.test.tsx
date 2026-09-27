// @vitest-environment jsdom
// КК9 на планировании и разборе (М4): панель состояния у плана и отправка итогов с конфликтом.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { blankSession } from '../local/normalize'
import type { Kk9State } from '../local/kk9'
import { readyCampaign, renderApp } from '../test/renderApp'
import { FakeBridge } from '../test/fakeBridge'

const kk9 = { kk9: { externalId: 'k1', label: 'Академия' } }
const state = (): Kk9State => ({
  fetchedAt: '2026-09-27T00:00:00.000Z',
  campaign: { name: 'Академия', gameDate: '1925-10-03', weather: 'Дождь', worldNote: '', nextSession: '' },
  party: [{ id: 'pc1', name: 'Мира', physical: { damage: 2, max: 6 }, mental: { damage: 0, max: 7 }, energy: { value: 4, max: 7 }, tension: { current: 6, max: 10, overcap: 0, zone: 'yellow' }, stunned: false, statuses: [{ name: 'Ранен', term: 'до конца сцены' }] }],
  journal: [{ id: 'j1', stream: 'campaign', title: 'Сессия 1', body: 'Нашли ключ.', at: 1000 }],
  requests: [{ id: 'r1', kind: 'Предмет', character: 'Мира', name: 'Метла', description: '', at: 1 }],
})

describe('КК9 у плана сессии', () => {
  it('панель показывает стол, партию, заявки и журнал', async () => {
    const user = userEvent.setup()
    const bridge = new FakeBridge()
    bridge.kk9.set('k1', state())
    const { catalog, id } = await readyCampaign({ integrations: kk9 })
    renderApp(`/local/campaign/${id}/session`, catalog, bridge)
    await user.click(await screen.findByRole('button', { name: 'КК9' }))
    const panel = await screen.findByRole('complementary', { name: 'Состояние КК9' })
    expect(await within(panel).findByRole('article', { name: 'Партия: Мира' })).toBeInTheDocument()
    expect(within(panel).getByText('1925-10-03')).toBeInTheDocument()
    expect(within(panel).getByText(/Ранен/)).toBeInTheDocument()
    expect(within(panel).getByText('Метла')).toBeInTheDocument()
    expect(within(panel).getByText('Сессия 1')).toBeInTheDocument()
  })

  it('без связи с КК9 кнопки нет', async () => {
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/session`, catalog)
    await screen.findByRole('button', { name: 'Добавить в план' })
    expect(screen.queryByRole('button', { name: 'КК9' })).toBeNull()
  })
})

describe('КК9 в разборе', () => {
  it('отправляет итоги и дату, повтор после правки в КК9 — конфликт с выбором', async () => {
    const user = userEvent.setup()
    const bridge = new FakeBridge()
    bridge.kk9.set('k1', state())
    const session = { ...blankSession(1, 'Сова', '2026-09-26T08:00:00.000Z', 'session-1'), title: 'Первая ночь', status: 'completed' as const, reviewStatus: 'completed' as const, reviewNotes: 'Порт в панике', nextGame: { date: '2026-10-10', time: '19:00' } }
    const { catalog, id } = await readyCampaign({ sessionRecords: [session], activeSessionId: 'session-1', integrations: kk9 })
    renderApp(`/local/campaign/${id}/review`, catalog, bridge)
    const send = await screen.findByRole('region', { name: 'Отправить в КК9' })
    await user.click(within(send).getByRole('button', { name: 'Отправить итоги в КК9' }))
    expect(await within(send).findByText(/записано/)).toBeInTheDocument()
    expect(bridge.kk9Sessions[0].body).toMatchObject({ journal: { stream: 'campaign', title: 'Сессия №1 — Первая ночь', body: 'Порт в панике' }, nextSession: 'суббота, 10 октября, 19:00' })
    await waitFor(async () => expect((await catalog.find(id))!.sessionRecords[0].kk9Sent?.stream).toBe('campaign'))
    // Страницу поправили в КК9.
    bridge.kk9Pages.set('session-1', { stream: 'campaign', title: 'Сессия №1 — Первая ночь', body: 'Правка мастера в КК9' })
    await user.click(within(send).getByRole('button', { name: 'Отправить снова' }))
    const clash = await within(send).findByRole('alert')
    expect(within(clash).getByText(/Правка мастера в КК9/)).toBeInTheDocument()
    await user.click(within(clash).getByRole('button', { name: 'Перезаписать версией Masterboard' }))
    await waitFor(() => expect(bridge.kk9Pages.get('session-1')?.body).toBe('Порт в панике'))
    expect(bridge.kk9Sessions.at(-1)!.body.journal).toMatchObject({ force: true })
  })
})
