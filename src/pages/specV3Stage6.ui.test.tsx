// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { createLocalCampaignCatalog } from '../local/catalog'
import { newEntity } from '../local/domain'
import { newInboxItem } from '../local/inbox'
import type { LocalSessionPlanItem } from '../local/types'
import { readyCampaign, renderApp } from '../test/renderApp'

const item = (id: string, text: string, patch: Partial<LocalSessionPlanItem> = {}): LocalSessionPlanItem =>
  ({ id, source: 'text', text, kind: 'npc', priority: 'desired', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared', ...patch })

const INBOX_ACTIONS = ['В задачу', 'В библиотеку', 'В часы', 'В секрет', 'В заметку']
const actionsOf = (group: HTMLElement) => within(group).getAllByRole('button').map((button) => button.textContent).filter((text) => text)

describe('ТЗ-3, этап 6: глоссарий и тексты', () => {
  it('saves a new campaign without placeholders and shows them in the interface only', async () => {
    const user = userEvent.setup()
    const catalog = createLocalCampaignCatalog(new MemoryStorageGateway())
    renderApp('/', catalog)
    await user.click(await screen.findByRole('button', { name: /Новая кампания/ }))
    const dialog = screen.getByRole('dialog', { name: 'С чего начинается история?' })
    expect(within(dialog).queryByText(/в этом браузере/)).not.toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Название'), 'Маяк')
    await user.click(within(dialog).getByRole('button', { name: 'Создать' }))
    expect(await screen.findByText('Новая история ждёт первой сессии.')).toBeInTheDocument()
    const stored = (await catalog.load()).campaigns.find((campaign) => campaign.name === 'Маяк')!
    expect(stored.idea).toBe('')
    expect(stored.activeTime).toBe('')
    expect(stored.masters[0].name).not.toBe('Ведущий')
  })

  it('names the tab after the section and the campaign', async () => {
    const { catalog, id } = await readyCampaign({ entities: [newEntity({ id: 'olan', type: 'npc', name: 'Олан' })] })
    renderApp(`/local/campaign/${id}/library`, catalog)
    await waitFor(() => expect(document.title).toBe('Библиотека · Город под стеклом · Мастерборд'))
    renderApp(`/local/campaign/${id}/entity/olan`, catalog)
    await waitFor(() => expect(document.title).toBe('Олан · Город под стеклом · Мастерборд'))
    renderApp('/import', catalog)
    await waitFor(() => expect(document.title).toBe('Импорт · Мастерборд'))
  })

  it('offers the same inbox actions on the Overview and in the Control panel', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ inbox: [newInboxItem('Лодочник Гран', '2026-09-28T10:00:00.000Z')] })
    renderApp(`/local/campaign/${id}/overview`, catalog)
    const overview = await screen.findByRole('group', { name: 'Разобрать: Лодочник Гран' })
    expect(actionsOf(overview)).toEqual(INBOX_ACTIONS)
    expect(screen.getByRole('button', { name: 'Записать' })).toBeInTheDocument()

    renderApp(`/local/campaign/${id}/control?tab=inbox`, catalog)
    const panel = await screen.findByRole('group', { name: 'Разобрать: Лодочник Гран' })
    expect(actionsOf(panel)).toEqual(INBOX_ACTIONS)
    await user.click(within(panel).getByRole('button', { name: 'В заметку' }))
    await waitFor(async () => expect((await catalog.find(id))!.inbox).toEqual([]))
  })

  it('shows the role of a plan item in the scene tree and on the director sheet', async () => {
    const { catalog, id } = await readyCampaign()
    const campaign = (await catalog.find(id))!
    await catalog.update({ ...campaign, sessionRecords: campaign.sessionRecords.map((session) => ({ ...session, planItems: [item('a', 'Лодочник Гран', { role: 'Проводник' })] })) })
    renderApp(`/local/campaign/${id}/session`, catalog)
    const card = await screen.findByRole('article', { name: 'Пункт плана: Лодочник Гран' })
    expect(within(card).getByText('— Проводник')).toBeInTheDocument()
    renderApp(`/local/campaign/${id}/print`, catalog)
    const sheet = await screen.findByRole('article', { name: 'Режиссёрский лист' })
    expect(within(sheet).getByText('— Проводник')).toBeInTheDocument()
  })

  it('splits where a record came from and where it is sent in the library table', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities: [newEntity({ type: 'npc', name: 'Олан' })] })
    renderApp(`/local/campaign/${id}/library`, catalog)
    await user.click(await screen.findByRole('button', { name: /Таблица/ }))
    const table = await screen.findByRole('table')
    expect(within(table).getByRole('columnheader', { name: /Источник/ })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: /Куда отправлять/ })).toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: /Где хранится/ })).not.toBeInTheDocument()
    expect(within(table).getByRole('cell', { name: 'NPC' })).toBeInTheDocument()
    expect(within(table).getByRole('cell', { name: 'Только мастерам' })).toBeInTheDocument()
  })

  it('names the themes in Russian', async () => {
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/overview`, catalog)
    const switcher = await screen.findByLabelText('Оформление интерфейса')
    expect(within(switcher).getAllByRole('button').map((button) => button.getAttribute('aria-label')))
      .toEqual(['Пергамент', 'Шалфей', 'Суми', 'Индиго', 'Сумерки', expect.stringMatching(/^(Тёмная|Светлая) тема$/)])
  })
})
