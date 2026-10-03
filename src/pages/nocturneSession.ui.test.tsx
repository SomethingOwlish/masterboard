// @vitest-environment jsdom
// Ноктюрн на планировании и разборе: панель стола (V5-треки, районы, хроника) и
// итоги — резюме, «Новое в мире», дата с временем, районы карты, конфликт поста.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { blankSession } from '../local/normalize'
import type { NocturneState } from '../local/nocturne'
import { readyCampaign, renderApp } from '../test/renderApp'
import { FakeBridge } from '../test/fakeBridge'

const nocturne = { nocturne: { externalId: 'c1', label: 'Детройт' } }
const state = (): NocturneState => ({
  fetchedAt: '2026-10-03T00:00:00.000Z',
  campaign: { name: 'Детройт', system: 'vtm5', nextSession: { date: '2026-10-11', time: '19:00' }, tenets: [] },
  party: [{ id: 'pc1', name: 'Вера', subtitle: 'Тореадор · Стен', flags: ['Торпор'], statuses: [{ name: 'Ослеплена', term: '' }], tracks: [
    { label: 'Здоровье', max: 5, damage: [{ label: 'Поверхностный', count: 1 }, { label: 'Тяжёлый', count: 0 }] },
    { label: 'Голод', value: 3, max: 5 },
  ] }],
  journal: [{ id: 'p1', stream: 'gmPrivate', kind: 'Заметка', title: 'Тайна принца', body: 'Только мастеру', at: 1000 }],
  requests: [{ id: 'a1', kind: 'Дисциплина', character: 'Вера', name: 'Присутствие → 3', description: 'Стоимость: 15 XP', at: 1 }],
  districts: [
    { id: 'corktown', name: 'Корктаун', factionId: 'f1', faction: 'Анархи', tension: 3, tensionLabel: 'Волнения', description: '', unavailable: false },
    { id: 'delray', name: 'Делрей', factionId: '', faction: '', tension: 0, tensionLabel: 'Покой', description: '', unavailable: false },
  ],
  factions: [{ id: 'f1', name: 'Анархи' }],
})

describe('Ноктюрн у плана сессии', () => {
  it('панель показывает партию треками, районы, заявки на опыт и хронику', async () => {
    const user = userEvent.setup()
    const bridge = new FakeBridge()
    bridge.nocturne.set('c1', state())
    const { catalog, id } = await readyCampaign({ integrations: nocturne })
    renderApp(`/local/campaign/${id}/session`, catalog, bridge)
    await user.click(await screen.findByRole('button', { name: 'Ноктюрн' }))
    const panel = await screen.findByRole('complementary', { name: 'Состояние Ноктюрна' })
    const vera = await within(panel).findByRole('article', { name: 'Партия: Вера' })
    expect(within(vera).getByText('Здоровье 1/5 (поверхностный 1) · Голод 3/5')).toBeInTheDocument()
    expect(within(vera).getByText('Торпор')).toBeInTheDocument()
    expect(within(panel).getByText('11.10.26, 19:00')).toBeInTheDocument()
    const districts = within(panel).getByRole('region', { name: 'Районы Ноктюрна' })
    expect(within(districts).getByText('Корктаун')).toBeInTheDocument()
    expect(within(districts).queryByText('Делрей')).toBeNull()
    expect(within(panel).getByText('Присутствие → 3')).toBeInTheDocument()
    expect(within(panel).getByText('Тайна принца')).toBeInTheDocument()
  })
})

describe('Ноктюрн в разборе', () => {
  it('отправляет резюме, новости, дату с временем и район; правка поста в Ноктюрне — конфликт', async () => {
    const user = userEvent.setup()
    const bridge = new FakeBridge()
    bridge.nocturne.set('c1', state())
    const session = {
      ...blankSession(1, 'Сова', '2026-09-26T08:00:00.000Z', 'session-1'), title: 'Склад', status: 'completed' as const, reviewStatus: 'completed' as const,
      reviewNotes: 'Склад сгорел', nextGame: { date: '2026-10-18', time: '19:00' },
      log: [{ id: 'l1', kind: 'entity' as const, text: 'Анархи взяли Делрей', createdAt: '2026-09-26T09:00:00.000Z' }],
    }
    const { catalog, id } = await readyCampaign({ sessionRecords: [session], activeSessionId: 'session-1', integrations: nocturne })
    renderApp(`/local/campaign/${id}/review`, catalog, bridge)
    const send = await screen.findByRole('region', { name: 'Отправить в Ноктюрн' })
    await user.selectOptions(within(send).getByRole('combobox', { name: 'Видимость резюме в Ноктюрне' }), 'gmPrivate')
    await user.click(within(send).getByText(/^Районы карты/))
    const map = await within(send).findByRole('group', { name: 'Районы карты Ноктюрна' })
    await user.selectOptions(within(map).getByRole('combobox', { name: 'Напряжение: Делрей' }), '2')
    await user.selectOptions(within(map).getByRole('combobox', { name: 'Держатель: Делрей' }), 'f1')
    await user.click(within(send).getByRole('button', { name: 'Отправить итоги в Ноктюрн' }))
    expect(await within(send).findByText(/Районы карты: обновлено 1/)).toBeInTheDocument()
    expect(bridge.nocturneSessions[0].body).toMatchObject({
      journal: { stream: 'gmPrivate', title: 'Сессия №1 — Склад', body: 'Склад сгорел' },
      news: { title: 'Новое в мире — Сессия №1 — Склад', body: '— Анархи взяли Делрей' },
      nextSession: { date: '2026-10-18', time: '19:00' },
      districts: [{ id: 'delray', tension: 2, factionId: 'f1' }],
    })
    await waitFor(async () => expect((await catalog.find(id))!.sessionRecords[0].nocturneSent).toMatchObject({ stream: 'gmPrivate', postId: 'post-journal:session-1', newsId: 'post-news:session-1', nextSession: '18.10.26, 19:00' }))

    // Резюме поправили в Ноктюрне.
    bridge.nocturnePosts.set('journal:session-1', { title: 'Сессия №1 — Склад', body: 'Правка в Ноктюрне', isPrivate: true })
    await user.click(within(send).getByRole('button', { name: 'Отправить снова' }))
    const clash = await within(send).findByRole('alert')
    expect(within(clash).getByText(/Правка в Ноктюрне/)).toBeInTheDocument()
    await user.click(within(clash).getByRole('button', { name: 'Перезаписать версией Masterboard' }))
    await waitFor(() => expect(bridge.nocturnePosts.get('journal:session-1')?.body).toBe('Склад сгорел'))
    expect(bridge.nocturneSessions.at(-1)!.body.journal).toMatchObject({ force: true })
    expect(bridge.nocturneSessions.at(-1)!.body.districts).toBeUndefined()
  })
})
