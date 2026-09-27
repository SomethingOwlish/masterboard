// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newEntity } from '../local/domain'
import { FakeBridge, LOREBOOK } from '../test/fakeBridge'
import { readyCampaign, renderApp } from '../test/renderApp'

describe('publishing to lorebook and lovegame', () => {
  it('links the campaign, queues with the default type, sends, and retries after an outage', async () => {
    const user = userEvent.setup()
    const bridge = new FakeBridge()
    const { catalog, id } = await readyCampaign({ entities: [newEntity({ id: 'npc', type: 'npc', name: 'Олан', fields: { motive: 'Искупление' } })] })
    renderApp(`/local/campaign/${id}/publish`, catalog, bridge)
    expect(screen.queryByLabelText('Что публикуем')).not.toBeInTheDocument()
    await user.selectOptions(await screen.findByLabelText('Связь с Лорбук'), 'w-port')
    await user.selectOptions(await screen.findByLabelText('Что публикуем'), 'npc')
    await waitFor(() => expect(screen.getByLabelText('Тип там')).toHaveValue('character'))
    await user.click(screen.getByRole('button', { name: 'В очередь' }))
    bridge.failing.add(LOREBOOK)
    await user.click(screen.getByRole('button', { name: '1. Проверить черновики' }))
    const queue = await screen.findByRole('list', { name: 'Очередь публикации' })
    const pick = await within(queue).findByLabelText('Выбрать: Олан → Лорбук · Лунный порт')
    await waitFor(() => expect(pick).toBeEnabled())
    await user.click(pick)
    await user.click(screen.getByRole('button', { name: '2. Подтвердить выбранные' }))
    await user.click(screen.getByRole('button', { name: '3. Отправить подтверждённые (1)' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Отправить' }))
    expect(await screen.findByText('Отправлено: 0. Ошибок: 1.')).toBeInTheDocument()
    expect(within(queue).getByText('Лорбук: база не ответила')).toBeInTheDocument()

    bridge.failing.clear()
    await user.click(within(queue).getByLabelText('Выбрать: Олан → Лорбук · Лунный порт'))
    await user.click(screen.getByRole('button', { name: 'Повторить выбранные' }))
    await user.click(screen.getByRole('button', { name: '3. Отправить подтверждённые (1)' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Отправить' }))
    expect(await screen.findByText('Отправлено: 1. Ошибок: 0.')).toBeInTheDocument()
    expect(screen.getByText('История отправок · 1')).toBeInTheDocument()
    expect(bridge.records.get(LOREBOOK)?.[0]).toMatchObject({ name: 'Олан', type: 'character', fields: { 'Мотив': 'Искупление' }, visibility: 'master' })
    await waitFor(async () => expect((await catalog.find(id))?.entities[0].sources[0]).toMatchObject({ system: 'lorebook', containerId: 'w-port', id: 'ext-1' }))
  })

  it('says when the door to lorebridge is not configured', async () => {
    const bridge = new FakeBridge()
    bridge.listConnections = async () => { const { ExternalError } = await import('../local/external'); throw new ExternalError('не настроена', 501, 'unconfigured') }
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/publish`, catalog, bridge)
    expect(await screen.findByText('Связь с Лорбуком и ЛавГеймс ещё не настроена на сервере Мастерборда.')).toBeInTheDocument()
  })
})

describe('import and refresh in the library', () => {
  it('imports chosen records and refreshes them field by field, asking on a clash', async () => {
    const user = userEvent.setup()
    const bridge = new FakeBridge()
    bridge.seed(LOREBOOK, { id: 'e1', type: 'character', name: 'Смотритель маяка', summary: 'Следит за огнём.', fields: { 'Роль в истории': 'свидетель' } })
    bridge.seed(LOREBOOK, { id: 'e2', type: 'faction', name: 'Гильдия фонарей' })
    const { catalog, id } = await readyCampaign({ integrations: { lorebook: { externalId: 'w-port', label: 'Лунный порт' } } })
    renderApp(`/local/campaign/${id}/library`, catalog, bridge)
    await user.click(await screen.findByRole('button', { name: 'Из источника' }))
    const list = await screen.findByRole('list', { name: 'Записи источника' })
    await user.click(within(list).getByRole('checkbox', { name: /Смотритель маяка/ }))
    await user.click(screen.getByRole('button', { name: 'Добавить 1 в библиотеку' }))
    expect(await screen.findByRole('heading', { name: 'Смотритель маяка' })).toBeInTheDocument()

    bridge.editThere(LOREBOOK, 'e1', { summary: 'Следит за огнём и кораблями.' })
    await user.click(screen.getByRole('button', { name: 'Обновить из источника: Смотритель маяка (Лорбук)' }))
    expect(await screen.findByText('Обновлено: описание.')).toBeInTheDocument()
    expect(screen.getByText('Следит за огнём и кораблями.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Редактировать: Смотритель маяка' }))
    const role = screen.getByLabelText('Роль в истории')
    await user.clear(role)
    await user.type(role, 'соучастник')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    bridge.editThere(LOREBOOK, 'e1', { fields: { 'Роль в истории': 'жертва' } })
    await user.click(screen.getByRole('button', { name: 'Обновить из источника: Смотритель маяка (Лорбук)' }))
    const dialog = await screen.findByRole('dialog', { name: 'Изменено с обеих сторон' })
    await user.click(within(dialog).getByRole('radio', { name: /Мастерборд/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Применить' }))
    await waitFor(async () => expect((await catalog.find(id))?.entities.at(-1)?.fields.role).toBe('соучастник'))
  })
  it('marks lore moved from SystemSetup and shows «К удалению» when the system dropped the record', async () => {
    const user = userEvent.setup()
    const bridge = new FakeBridge()
    bridge.seed(LOREBOOK, { id: 'e7', type: 'lore', name: 'Старый обычай', source: { app: 'systemsetup', system: 'sys-k', dataset: 'codex', entry: 'obychai' } })
    const { catalog, id } = await readyCampaign({ integrations: { lorebook: { externalId: 'w-port', label: 'Лунный порт' } } })
    renderApp(`/local/campaign/${id}/library`, catalog, bridge)
    await user.click(await screen.findByRole('button', { name: 'Из источника' }))
    const list = await screen.findByRole('list', { name: 'Записи источника' })
    expect(within(list).getByText('Из Системсетапа')).toBeInTheDocument()
    await user.click(within(list).getByRole('checkbox', { name: /Старый обычай/ }))
    await user.click(screen.getByRole('button', { name: 'Добавить 1 в библиотеку' }))
    const card = (await screen.findByRole('heading', { name: 'Старый обычай' })).closest('article')!
    expect(within(card).getByText('Из Системсетапа')).toBeInTheDocument()
    expect(within(card).queryByText('К удалению')).not.toBeInTheDocument()

    bridge.editThere(LOREBOOK, 'e7', { status: 'removed' })
    await user.click(within(card).getByRole('button', { name: 'Обновить из источника: Старый обычай (Лорбук)' }))
    expect(await within(card).findByText('К удалению')).toBeInTheDocument()
    expect(within(card).getByText(/удалить её или оставить своей решает автор мира/)).toBeInTheDocument()
  })
})
