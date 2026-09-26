// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newEntity } from '../local/domain'
import { blankSession } from '../local/normalize'
import { readyCampaign, renderApp } from '../test/renderApp'

describe('library: where used', () => {
  it('lists the sessions an entity is planned in and blocks deleting it', async () => {
    const user = userEvent.setup()
    const planned = { ...blankSession(1, 'Сова', '2026-09-26T08:00:00.000Z', 's1'), title: 'Первая ночь', planItems: [{ id: 'p', source: 'library' as const, entityId: 'captain', text: 'Капитан', kind: 'npc' as const, priority: 'required' as const, status: 'prepared' as const, role: '', alternative: '', note: '', origin: 'prepared' as const }] }
    const { catalog, id } = await readyCampaign({ sessionRecords: [planned], activeSessionId: 's1', entities: [newEntity({ id: 'captain', type: 'npc', name: 'Капитан' }), newEntity({ id: 'free', type: 'npc', name: 'Бродяга' })] })
    renderApp(`/local/campaign/${id}/library`, catalog)
    const card = (await screen.findByRole('heading', { name: 'Капитан' })).closest('article')!
    await user.click(within(card).getByText('Где используется · 1'))
    expect(within(card).getByRole('button', { name: '№1 Первая ночь' })).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Редактировать: Капитан' }))
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    const free = (await screen.findByRole('heading', { name: 'Бродяга' })).closest('article')!
    expect(within(free).queryByText(/Где используется/)).not.toBeInTheDocument()
    await user.click(within(free).getByRole('button', { name: 'Редактировать: Бродяга' }))
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeEnabled()
  })
})
