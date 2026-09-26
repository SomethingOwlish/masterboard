// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
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
