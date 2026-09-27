// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newEntity } from '../local/domain'
import { readyCampaign, renderApp } from '../test/renderApp'

describe('library table and bulk actions (ТЗ-2, R7)', () => {
  it('picks rows and tags, hides and archives them together', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities: [newEntity({ id: 'a', type: 'npc', name: 'Олан' }), newEntity({ id: 'b', type: 'npc', name: 'Мирта' }), newEntity({ id: 'c', type: 'location', name: 'Гавань' })] })
    renderApp(`/local/campaign/${id}/library`, catalog)
    await user.click(await screen.findByRole('button', { name: /Таблица/ }))
    const table = screen.getByRole('table', { name: 'Библиотека таблицей' })
    await user.click(within(table).getByRole('checkbox', { name: 'Выбрать: Олан' }))
    await user.click(within(table).getByRole('checkbox', { name: 'Выбрать: Мирта' }))
    const bar = screen.getByRole('region', { name: 'Действия с выбранными' })
    expect(within(bar).getByText('Выбрано: 2')).toBeInTheDocument()
    await user.click(within(bar).getByRole('button', { name: 'Теги' }))
    await user.type(within(bar).getByLabelText('Теги для выбранных'), 'гильдия')
    await user.click(within(bar).getByRole('button', { name: 'Добавить' }))
    await user.click(within(bar).getByRole('button', { name: 'Видимость' }))
    await user.click(within(bar).getByRole('button', { name: 'Для игроков' }))
    await user.click(within(bar).getByRole('button', { name: 'Архив' }))
    await user.click(within(bar).getByRole('button', { name: 'В архив' }))
    await waitFor(async () => {
      const saved = (await catalog.find(id))!
      expect(saved.entities.map((entity) => [entity.name, entity.tags, entity.visibility, entity.status])).toEqual([['Олан', ['гильдия'], 'public', 'archived'], ['Мирта', ['гильдия'], 'public', 'archived'], ['Гавань', [], 'master', 'active']])
    })
    expect(within(screen.getByRole('table', { name: 'Библиотека таблицей' })).queryByText('Олан')).not.toBeInTheDocument()
  })
})
