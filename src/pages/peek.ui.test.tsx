// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newClock, newEntity } from '../local/domain'
import { readyCampaign, renderApp } from '../test/renderApp'

const entities = [newEntity({ id: 'olan', type: 'npc', name: 'Олан', description: 'Старый фонарщик', tags: ['гильдия'] }), newEntity({ id: 'port', type: 'location', name: 'Гавань', tags: ['порт'] })]

describe('side panel, search and entity page (ТЗ-2, R5/R9)', () => {
  it('opens a name from another section in the side panel and follows its links', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities, clocks: [newClock({ id: 'tide', title: 'Прилив', entityIds: ['olan'] })] })
    renderApp(`/local/campaign/${id}/control`, catalog)
    const clock = await screen.findByRole('article', { name: 'Часы: Прилив' })
    await user.click(within(clock).getByRole('button', { name: 'Олан' }))
    const panel = await screen.findByRole('complementary', { name: 'NPC: Олан' })
    expect(within(panel).getByText('Старый фонарщик')).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Часы «Прилив»' }))
    expect(await screen.findByRole('complementary', { name: 'Часы: Прилив' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Назад' }))
    await user.click(within(await screen.findByRole('complementary', { name: 'NPC: Олан' })).getByRole('button', { name: 'Открыть полностью' }))
    expect(await screen.findByRole('navigation', { name: 'Путь' })).toHaveTextContent('Библиотека › NPC')
    expect(screen.getByRole('heading', { name: 'Олан', level: 2 })).toBeInTheDocument()
  })

  it('finds a record with Ctrl+K and opens it with Enter', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities })
    renderApp(`/local/campaign/${id}/overview`, catalog)
    await screen.findByRole('navigation', { name: 'Разделы кампании' })
    await user.keyboard('{Control>}k{/Control}')
    await user.type(await screen.findByLabelText('Что ищем'), 'фонарщик')
    expect(screen.getByRole('option', { name: /Олан/ })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('complementary', { name: 'NPC: Олан' })).toBeInTheDocument()
  })

  it('saves a set of library filters for this master', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities })
    renderApp(`/local/campaign/${id}/library`, catalog)
    await user.click(await screen.findByRole('button', { name: /Фильтры/ }))
    await user.click(screen.getByRole('checkbox', { name: '#порт' }))
    expect(screen.queryByRole('heading', { name: 'Олан' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Сохранить подборку' }))
    await user.type(screen.getByLabelText('Название подборки'), 'Порт{Enter}')
    await user.click(screen.getByRole('button', { name: 'Сбросить' }))
    expect(screen.getByRole('heading', { name: 'Олан' })).toBeInTheDocument()
    await user.click(within(screen.getByRole('group', { name: 'Мои подборки' })).getByRole('button', { name: 'Порт' }))
    expect(screen.queryByRole('heading', { name: 'Олан' })).not.toBeInTheDocument()
    await waitFor(async () => expect(Object.values((await catalog.find(id))!.savedFilters ?? {})[0]).toEqual([expect.objectContaining({ name: 'Порт', filter: expect.objectContaining({ tags: ['порт'] }) })]))
  })
})
