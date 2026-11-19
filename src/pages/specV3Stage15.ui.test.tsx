// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { NAV_GROUPS } from '../components/local/shared'
import { readyCampaign, renderApp } from '../test/renderApp'

describe('ТЗ-3, этап 15: «Команда» в меню кампании', () => {
  it('keeps «Команда» out of the section groups', () => {
    expect(NAV_GROUPS.map((group) => group.id)).toEqual(['prep', 'world', 'exchange'])
    expect(NAV_GROUPS.flatMap((group) => group.sections as readonly string[])).not.toContain('team')
  })

  it('opens the team, the campaign editor and the export from the campaign name', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign()
    const { router } = renderApp(`/local/campaign/${id}/library`, catalog)
    const nav = await screen.findByRole('navigation', { name: 'Разделы кампании' })
    expect(within(nav).queryByRole('link', { name: /Команда/ })).not.toBeInTheDocument()

    const toggle = screen.getByRole('button', { name: 'Меню кампании «Город под стеклом»' })
    await user.click(toggle)
    const menu = screen.getByRole('menu', { name: 'Кампания' })
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent?.trim())).toEqual(['Команда', 'Редактировать кампанию', 'Экспорт'])
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu', { name: 'Кампания' })).not.toBeInTheDocument()

    await user.click(toggle)
    await user.click(screen.getByRole('menuitem', { name: 'Команда' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/local/campaign/${id}/team`))

    await user.click(screen.getByRole('button', { name: 'Меню кампании «Город под стеклом»' }))
    await user.click(screen.getByRole('menuitem', { name: 'Редактировать кампанию' }))
    const dialog = await screen.findByRole('dialog', { name: 'Редактировать кампанию' })
    expect(within(dialog).getByLabelText('Название')).toHaveValue('Город под стеклом')
    expect(router.state.location.search).toBe('')
  })

  it('has the same menu in the sessions workspace', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Меню кампании «Город под стеклом»' }))
    expect(screen.getByRole('menuitem', { name: 'Команда' })).toBeInTheDocument()
  })
})
