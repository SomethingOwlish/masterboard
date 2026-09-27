// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newEntity } from '../local/domain'
import { blankSession } from '../local/normalize'
import type { LocalSessionPlanItem } from '../local/types'
import { readyCampaign, renderApp } from '../test/renderApp'

const NOW = '2026-09-26T08:00:00.000Z'
const planItem = (id: string, text: string): LocalSessionPlanItem => ({ id, source: 'text', text, kind: 'scene', priority: 'required', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared' })
const session = (id: string, number: number, title: string, patch: Partial<ReturnType<typeof blankSession>> = {}) => ({ ...blankSession(number, 'Сова', NOW, id), title, planItems: [planItem(`${id}-p`, 'Ворота')], ...patch })

describe('session lifecycle', () => {
  it('duplicates a session, trashes it and restores it without reusing its number', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ sessionRecords: [session('s1', 1, 'Первая ночь')], activeSessionId: 's1' })
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Дублировать' }))
    expect(await screen.findByRole('heading', { name: 'Первая ночь (копия)' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'В корзину' }))
    const trash = await screen.findByText('Корзина · 1')
    expect(screen.queryByRole('heading', { name: 'Первая ночь (копия)' })).not.toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[1].deletedAt).toBeTruthy())
    await user.click(trash)
    await user.click(within(trash.closest('details')!).getByRole('button', { name: 'Восстановить' }))
    expect(await screen.findByRole('heading', { name: 'Первая ночь (копия)' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Новая' }))
    expect(screen.getByLabelText('Номер')).toHaveValue(3)
  })

  it('deletes trashed sessions for good after a confirmation', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ sessionRecords: [session('s1', 1, 'Первая ночь'), session('s2', 2, 'Лишняя', { deletedAt: NOW }), session('s3', 3, 'Черновик', { deletedAt: NOW })], activeSessionId: 's1' })
    renderApp(`/local/campaign/${id}/session`, catalog)
    const trash = await screen.findByText('Корзина · 2')
    await user.click(trash)
    await user.click(screen.getByRole('button', { name: 'Удалить навсегда №2 Лишняя' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Удалить навсегда' }))
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords.map((item) => item.id)).toEqual(['s1', 's3']))
    expect(await screen.findByText('Корзина · 1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Очистить корзину' })).not.toBeInTheDocument()
  })

  it('imports sessions from a JSON file after a preview, keeping the import controls tucked away', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ sessionRecords: [session('s1', 1, 'Первая ночь')], activeSessionId: 's1' })
    renderApp(`/local/campaign/${id}/session`, catalog)
    const summary = await screen.findByText('Импорт из файла')
    expect(summary.closest('details')).not.toHaveAttribute('open')
    const json = JSON.stringify({ format: 'masterboard-sessions/v1', sessions: [{ title: 'Прилив', scenes: [{ title: 'Пристань', items: ['Туман'] }] }] })
    // jsdom's File has no text(); the browser one does.
    const file = Object.assign(new File([json], 'sessions.json', { type: 'application/json' }), { text: async () => json })
    await user.upload(screen.getByLabelText('Файл сессий для импорта'), file)
    const dialog = await screen.findByRole('dialog', { name: 'Импорт сессий' })
    expect(within(dialog).getByText('№2 Прилив')).toBeInTheDocument()
    expect(within(dialog).getByText('1 сцена · 2 пункта плана · 0 переходов')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /Импортировать · 1/ }))
    expect(await screen.findByRole('heading', { name: 'Прилив' })).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[1].planItems.map((item) => item.text)).toEqual(['Пристань', 'Туман']))
  })

  it('files new NPCs from an import into the library and lets scenes and items be edited', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ sessionRecords: [session('s1', 1, 'Первая ночь')], activeSessionId: 's1' })
    renderApp(`/local/campaign/${id}/session`, catalog)
    const json = JSON.stringify({ sessions: [{ title: 'Прилив', scenes: [{ title: 'Пристань', items: [{ kind: 'npc', text: 'Мирта' }, 'Туман'] }] }] })
    const file = Object.assign(new File([json], 'sessions.json', { type: 'application/json' }), { text: async () => json })
    await user.upload(await screen.findByLabelText('Файл сессий для импорта'), file)
    const dialog = await screen.findByRole('dialog', { name: 'Импорт сессий' })
    expect(within(dialog).getByRole('checkbox', { name: 'Создать в библиотеке и секретах' })).toBeChecked()
    expect(within(dialog).getByText('Мирта')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /Импортировать · 1/ }))
    await waitFor(async () => expect((await catalog.find(id))?.entities.map((entity) => entity.name)).toContain('Мирта'))
    expect(within(await screen.findByRole('article', { name: 'Пункт плана: Мирта' })).getByText('Библиотека')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Редактировать: Пристань' }))
    const editor = await screen.findByRole('dialog', { name: 'Сцена' })
    await user.clear(within(editor).getByLabelText('Название'))
    await user.type(within(editor).getByLabelText('Название'), 'Причал')
    await user.type(within(editor).getByLabelText('Комментарий к сцене'), 'Туман густеет')
    await user.click(within(editor).getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByRole('region', { name: 'Сцена: Причал' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Редактировать: Туман' }))
    const item = await screen.findByRole('dialog', { name: 'Пункт плана' })
    await user.selectOptions(within(item).getByLabelText('Сцена'), '')
    await user.click(within(item).getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () => {
      const saved = (await catalog.find(id))?.sessionRecords[1].planItems
      expect(saved?.find((entry) => entry.kind === 'scene')).toMatchObject({ text: 'Причал', note: 'Туман густеет' })
      expect(saved?.find((entry) => entry.text === 'Туман')?.sceneId).toBeUndefined()
    })
  })

  it('blocks starting a second game and trashing a running one', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ sessionRecords: [session('s1', 1, 'Идёт', { status: 'active' }), session('s2', 2, 'Следующая', { status: 'ready' })], activeSessionId: 's1' })
    renderApp(`/local/campaign/${id}/session`, catalog)
    expect(await screen.findByRole('button', { name: 'В корзину' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Следующая/ }))
    const start = await screen.findByRole('button', { name: 'Начать' })
    expect(start).toBeDisabled()
    expect(start).toHaveAttribute('title', expect.stringContaining('уже идёт'))
  })

  it('changes the status only with buttons: no status in the passport, «Готова» by a button, a draft asks before starting', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ sessionRecords: [session('s1', 1, 'Первая ночь')], activeSessionId: 's1' })
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Паспорт' }))
    const passport = await screen.findByRole('dialog', { name: 'Паспорт сессии' })
    expect(within(passport).queryByLabelText('Статус')).not.toBeInTheDocument()
    await user.click(within(passport).getByRole('button', { name: 'Отмена' }))

    await user.click(screen.getByRole('button', { name: 'Начать' }))
    const ask = await screen.findByRole('dialog')
    expect(ask).toHaveTextContent('не отмечена готовой')
    await user.click(within(ask).getByRole('button', { name: 'Отмена' }))
    expect((await catalog.find(id))?.sessionRecords[0].status).toBe('draft')

    await user.click(screen.getByRole('button', { name: 'Отметить готовой' }))
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].status).toBe('ready'))
    await user.click(await screen.findByRole('button', { name: 'Начать' }))
    expect(await screen.findByLabelText('Живая панель')).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].status).toBe('active'))
  })

  it('explains why a session with an empty plan cannot start and refuses a zero number', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ sessionRecords: [session('s1', 1, 'Пустая', { planItems: [] }), session('s2', 2, 'Вторая')], activeSessionId: 's1' })
    renderApp(`/local/campaign/${id}/session`, catalog)
    const start = await screen.findByRole('button', { name: 'Начать' })
    expect(start).toBeDisabled()
    expect(start).toHaveAttribute('title', 'Добавьте в план хотя бы один пункт')
    await user.click(screen.getByRole('button', { name: 'Паспорт' }))
    const number = screen.getByLabelText('Номер')
    await user.clear(number)
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled()
    await user.type(number, '2')
    expect(screen.getByText(/Номер 2 уже у сессии «Вторая»/)).toBeInTheDocument()
  })

  it('tells a closed session that waits for its review from a reviewed one, and «Разобрать» brings the review forward', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ sessionRecords: [session('s1', 1, 'Сыграна', { status: 'completed', reviewStatus: 'completed' }), session('s2', 2, 'Ждёт', { status: 'completed' })], activeSessionId: 's2' })
    renderApp(`/local/campaign/${id}/session`, catalog)
    expect(await screen.findByRole('button', { name: /Сыграна.*Разобрана/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ждёт.*Закрыта · нужен разбор/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Разобрать' }))
    await waitFor(() => expect(document.activeElement).toHaveAccessibleName('Разбор сессии'))
  })

  it('remembers that a live log entry was already sent after a reload', async () => {
    const user = userEvent.setup()
    const log = [{ id: 'log-1', text: 'Бран обиделся', kind: 'moment' as const, createdAt: NOW }]
    const { catalog, id } = await readyCampaign({ sessionRecords: [session('s1', 1, 'Идёт', { status: 'active', log })], activeSessionId: 's1' })
    renderApp(`/local/campaign/${id}/play`, catalog)
    const panel = await screen.findByLabelText('Живая панель')
    await user.click(within(panel).getByRole('button', { name: 'В задачу' }))
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].log[0].sentTo).toBe('task'))
    cleanup()
    renderApp(`/local/campaign/${id}/play`, catalog)
    const again = await screen.findByLabelText('Живая панель')
    expect(within(again).getByText('В задачах')).toBeInTheDocument()
    expect(within(again).queryByRole('button', { name: 'В задачу' })).not.toBeInTheDocument()
    expect((await catalog.find(id))?.tasks).toHaveLength(1)
  })

  it('stores a real play date and refuses an impossible one', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ sessionRecords: [session('s1', 1, 'Первая ночь')], activeSessionId: 's1' })
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Паспорт' }))
    const date = screen.getByLabelText('Дата игры')
    await user.type(date, '2026-10-03')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].date).toBe('2026-10-03'))
    expect(await screen.findByText('3 октября 2026 г.')).toBeInTheDocument()
  })
})

describe('live table cards', () => {
  it('shows the card fields of entities planned for the running session', async () => {
    const user = userEvent.setup()
    const running = session('s1', 1, 'Идёт', { status: 'active', planItems: [{ ...planItem('p', 'Олан'), source: 'library', entityId: 'olan', kind: 'npc' }] })
    const { catalog, id } = await readyCampaign({ sessionRecords: [running], activeSessionId: 's1', entities: [newEntity({ id: 'olan', type: 'npc', name: 'Олан', dead: true, fields: { motive: 'Искупление' } }), newEntity({ id: 'other', type: 'npc', name: 'Чужой' })] })
    renderApp(`/local/campaign/${id}/play`, catalog)
    await user.click(await screen.findByRole('button', { name: /Карточки/ }))
    const card = screen.getByRole('article', { name: 'Карточка: Олан' })
    expect(within(card).getByText('Искупление')).toBeInTheDocument()
    expect(within(card).getByText('Погиб')).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Карточка: Чужой' })).not.toBeInTheDocument()
  })
})
