// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { LocalCampaignCatalog } from '../local/catalog'
import { readyCampaign as ready, renderApp } from '../test/renderApp'

const readyCampaign = (notes: string[] = []) => ready({ notes })

describe('local campaign workspace', () => {
  it('creates a campaign and reaches the dashboard after the first session', async () => {
    const user = userEvent.setup()
    const { router, catalog } = renderApp('/')
    expect(await screen.findByLabelText('Версия сборки')).toHaveTextContent(new RegExp(`Версия ${__BUILD_HASH__}`))
    await user.click(await screen.findByRole('button', { name: 'Создать кампанию' }))
    await user.type(screen.getByLabelText('Название'), 'Город под стеклом')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Создать' }))
    await user.click(await screen.findByRole('link', { name: /Город под стеклом/ }))

    await user.type(await screen.findByLabelText('Название первой сессии'), 'Встреча у ворот')
    await user.click(screen.getByRole('button', { name: 'Создать сессию и открыть дашборд' }))

    const nav = await screen.findByRole('navigation', { name: 'Разделы кампании' })
    expect(within(nav).getAllByRole('button', { expanded: false }).map((button) => button.textContent?.trim())).toEqual(['ПодготовкаОбзор', 'Мир', 'Обмен'])
    expect(within(nav).getByRole('link', { name: /Команда/ })).toBeInTheDocument()
    await user.click(within(nav).getByRole('button', { name: /Мир/ }))
    expect(within(nav).getAllByRole('menuitem').map((link) => link.textContent?.trim())).toEqual(['Библиотека', 'Связи', 'Заметки', 'Заготовки'])
    await user.click(within(nav).getByRole('button', { name: /Мир/ }))
    expect(screen.getByRole('heading', { name: 'Встреча у ворот' })).toBeInTheDocument()
    const id = router.state.location.pathname.split('/')[3]
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].title).toBe('Встреча у ворот'))
  })

  it('keeps the dashboard open after the last note is deleted', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign(['Единственный факт'])
    renderApp(`/local/campaign/${id}/world`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Удалить: Единственный факт' }))
    expect(screen.getByRole('navigation', { name: 'Разделы кампании' })).toBeInTheDocument()
    expect(screen.queryByText('Единственный факт')).not.toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.notes).toEqual([]))
  })

  it('redirects an unknown section to the overview', async () => {
    const { catalog, id } = await readyCampaign()
    const { router } = renderApp(`/local/campaign/${id}/nonsense`, catalog)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/local/campaign/${id}/overview`))
    expect(await screen.findByText('Панель кампании')).toBeInTheDocument()
  })

  it('shows the full navigation inside the sessions workspace', async () => {
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/session`, catalog)
    const user = userEvent.setup()
    const nav = await screen.findByRole('navigation', { name: 'Разделы кампании' })
    await user.click(within(nav).getByRole('button', { name: /Подготовка.*Сессии/ }))
    expect(within(nav).getByRole('menuitem', { name: /Сессии/ })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('menuitem', { name: /Пульт/ })).toHaveAttribute('href', `/local/campaign/${id}/control`)
  })

  it('adds a library entity that survives reloading', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/library`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Новая сущность' }))
    await user.type(screen.getByLabelText('Название'), 'Смотритель')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByRole('heading', { name: 'Смотритель' })).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.entities.map((entity) => entity.name)).toEqual(['Смотритель']))
  })

  it('opens the example campaign in the real workspace', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/')
    await user.click(await screen.findByRole('link', { name: /Лунный порт/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/local/campaign/moon-port'))
    expect(await screen.findByText('Первая ночь в Лунном порту')).toBeInTheDocument()
  })

  it('keeps edits on screen and offers a retry when saving fails', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign()
    let fail = true
    const flaky: LocalCampaignCatalog = { ...catalog, update: (campaign) => fail ? Promise.reject(new Error('Диск переполнен')) : catalog.update(campaign) }
    renderApp(`/local/campaign/${id}/world`, flaky)
    await user.type(await screen.findByLabelText('Новая опорная точка'), 'Факт{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('Диск переполнен')
    expect(screen.getByText('Факт')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Повторить' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect((await catalog.find(id))?.notes).toEqual(['Факт'])
  })
})
