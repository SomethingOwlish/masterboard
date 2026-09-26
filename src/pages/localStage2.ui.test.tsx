// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newClock, newEntity, newSecret } from '../local/domain'
import { blankSession } from '../local/normalize'
import type { LocalSessionPlanItem } from '../local/types'
import { readyCampaign, renderApp } from '../test/renderApp'

const planItem = (id: string, text: string, patch: Partial<LocalSessionPlanItem> = {}): LocalSessionPlanItem => ({ id, source: 'text', text, kind: 'scene', priority: 'required', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared', ...patch })

async function activeSession(extra: Parameters<typeof readyCampaign>[0] = {}) {
  const session = { ...blankSession(1, 'Сова', '2026-09-26T08:00:00.000Z', 'session-1'), title: 'Первая ночь', status: 'active' as const, planItems: [planItem('p1', 'Ворота')] }
  return readyCampaign({ sessionRecords: [session], activeSessionId: 'session-1', ...extra })
}

describe('stage 2: relations', () => {
  it('creates a typed mutual relation and filters by type', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities: [newEntity({ id: 'a', type: 'npc', name: 'Олан' }), newEntity({ id: 'b', type: 'faction', name: 'Гильдия' })] })
    renderApp(`/local/campaign/${id}/map`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Новая связь' }))
    await user.type(screen.getByLabelText('Смысл связи'), 'состоит в')
    await user.selectOptions(screen.getByLabelText('Тип'), 'belongs')
    await user.selectOptions(screen.getByLabelText('Направление'), 'mutual')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByRole('article', { name: /Олан — состоит в — Гильдия/ })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Тип связи'), 'enmity')
    expect(screen.getByText('Под фильтр ничего не попало')).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.relations[0]).toMatchObject({ type: 'belongs', direction: 'mutual' }))
  })

  it('switches to the graph view', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities: [newEntity({ id: 'a', type: 'npc', name: 'Олан' }), newEntity({ id: 'b', type: 'faction', name: 'Гильдия' })] })
    renderApp(`/local/campaign/${id}/map`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Граф' }))
    expect(await screen.findByLabelText('Граф связей')).toBeInTheDocument()
  })
})

describe('stage 2: live session', () => {
  it('shows the live panel only for the active session', async () => {
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/play`, catalog)
    expect(await screen.findByRole('status')).toHaveTextContent('Эта сессия сейчас не проводится')
    expect(screen.queryByLabelText('Живая панель')).not.toBeInTheDocument()
  })

  it('logs typed moments, clock moves, reveals and new entities', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await activeSession({ clocks: [newClock({ id: 'c1', title: 'Прилив', segments: 4 })], secrets: [newSecret({ id: 's1', title: 'Цена', truth: 'Имена' })] })
    renderApp(`/local/campaign/${id}/play`, catalog)
    const panel = await screen.findByLabelText('Живая панель')
    await user.selectOptions(within(panel).getByLabelText('Вид записи'), 'decision')
    await user.type(within(panel).getByLabelText('Запись живого журнала'), 'Герои пошли в порт{Enter}')
    await user.click(within(panel).getByRole('button', { name: /Часы/ }))
    await user.type(within(panel).getByLabelText('Причина: Прилив'), 'Шторм')
    await user.click(within(panel).getByRole('button', { name: 'Продвинуть Прилив' }))
    await user.click(within(panel).getByRole('button', { name: /Секреты/ }))
    await user.selectOptions(within(panel).getByLabelText('Состояние секрета: Цена'), 'partial')
    await user.click(within(panel).getByRole('button', { name: 'Новое' }))
    await user.type(within(panel).getByLabelText('Имя новой сущности'), 'Трактирщик Бран')
    await user.click(within(panel).getByRole('button', { name: 'Создать в библиотеке' }))
    await waitFor(async () => {
      const saved = (await catalog.find(id))!
      expect(saved.sessionRecords[0].log.map((entry) => entry.kind)).toEqual(['decision', 'clock', 'reveal', 'entity'])
      expect(saved.clocks[0].value).toBe(1)
      expect(saved.secrets[0].reveals[0]).toMatchObject({ status: 'partial', sessionId: 'session-1' })
      expect(saved.entities[0]).toMatchObject({ name: 'Трактирщик Бран', origin: { kind: 'live', sessionId: 'session-1' } })
      expect(saved.sessionRecords[0].planItems.at(-1)).toMatchObject({ entityId: saved.entities[0].id, status: 'used', origin: 'live' })
    })
  })

  it('turns a log entry into a task that remembers the session', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await activeSession()
    renderApp(`/local/campaign/${id}/play`, catalog)
    const panel = await screen.findByLabelText('Живая панель')
    await user.type(within(panel).getByLabelText('Запись живого журнала'), 'Нужна карта порта{Enter}')
    await user.click(within(panel).getByRole('button', { name: 'В задачу' }))
    expect(within(panel).getByText('В задачах')).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.tasks[0]).toMatchObject({ text: 'Нужна карта порта', source: 'session', origin: { sessionId: 'session-1' } }))
    await user.click(screen.getByRole('link', { name: /Пульт/ }))
    await user.click(await screen.findByRole('button', { name: /Задачи/ }))
    expect(screen.getByText('Из сессии №1')).toBeInTheDocument()
  })

  it('asks before closing the session and opens the review', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await activeSession()
    const { router } = renderApp(`/local/campaign/${id}/play`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Закрыть сессию' }))
    await user.click(await screen.findByRole('button', { name: 'Продолжить игру' }))
    expect((await catalog.find(id))?.sessionRecords[0].status).toBe('active')
    await user.click(screen.getByRole('button', { name: 'Закрыть сессию' }))
    await user.click(await screen.findByRole('button', { name: 'Закрыть и разобрать' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/local/campaign/${id}/review`))
    expect(await screen.findByLabelText('Разбор сессии')).toBeInTheDocument()
  })
})

describe('stage 2: review wizard', () => {
  it('requires decisions, then carries items into the next session', async () => {
    const user = userEvent.setup()
    const session = { ...blankSession(1, 'Сова', '2026-09-26T08:00:00.000Z', 'session-1'), title: 'Первая ночь', status: 'completed' as const, planItems: [planItem('p1', 'Ворота'), planItem('p2', 'Погоня', { status: 'used' })] }
    const { catalog, id } = await readyCampaign({ sessionRecords: [session], activeSessionId: 'session-1', activeTime: 'Ночь 3' })
    renderApp(`/local/campaign/${id}/review`, catalog)
    const wizard = await screen.findByLabelText('Разбор сессии')
    await user.type(within(wizard).getByLabelText('Итоги сессии'), 'Порт в панике')
    await user.click(within(wizard).getByRole('button', { name: 'Далее' }))
    expect(within(wizard).getByText('Осталось решить: 1.')).toBeInTheDocument()
    expect(within(wizard).getByRole('button', { name: 'Далее' })).toBeDisabled()
    await user.selectOptions(within(wizard).getByLabelText('Решение: Ворота'), 'carry')
    await user.click(within(wizard).getByRole('button', { name: 'Далее' }))
    await user.click(within(wizard).getByRole('button', { name: 'Далее' }))
    const time = within(wizard).getByLabelText('Текущее время кампании после сессии')
    await user.clear(time)
    await user.type(time, 'Ночь 4')
    await user.click(within(wizard).getByRole('button', { name: 'Далее' }))
    expect(within(wizard).getByText('Переносятся пункты: Ворота.')).toBeInTheDocument()
    await user.click(within(wizard).getByRole('button', { name: 'Завершить разбор' }))
    await user.click(await screen.findByRole('button', { name: /Открыть сессию №2/ }))
    expect(await screen.findByRole('heading', { name: 'Ворота' })).toBeInTheDocument()
    const saved = (await catalog.find(id))!
    expect(saved.activeTime).toBe('Ночь 4')
    expect(saved.sessionRecords[0]).toMatchObject({ reviewStatus: 'completed', reviewNotes: 'Порт в панике' })
    expect(saved.sessionRecords[1].planItems[0]).toMatchObject({ text: 'Ворота', origin: 'review', carriedFromSessionId: 'session-1' })
  })
})

describe('stage 2: inbox', () => {
  it('turns an inbox item into a secret', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ inbox: [{ id: 'i1', text: 'Капитан врёт', tags: [], createdAt: '2026-09-26T08:00:00.000Z' }] })
    renderApp(`/local/campaign/${id}/control`, catalog)
    await user.click(await screen.findByRole('button', { name: /Входящие/ }))
    await user.click(screen.getByRole('button', { name: 'В секрет' }))
    await waitFor(async () => {
      const saved = (await catalog.find(id))!
      expect(saved.inbox).toEqual([])
      expect(saved.secrets[0]).toMatchObject({ title: 'Капитан врёт', truth: 'Капитан врёт' })
    })
  })
})
