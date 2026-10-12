// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { createLocalCampaignCatalog, type LocalCampaignCatalog } from '../local/catalog'
import { newEntity } from '../local/domain'
import { blankSession } from '../local/normalize'
import type { CampaignCatalog, CatalogState } from '../local/remote'
import { readyCampaign, renderApp } from '../test/renderApp'
import { Boot } from './SignInPage'

const OWNER = 'owl@example.com'
const signedIn = (catalog: LocalCampaignCatalog): CampaignCatalog => ({
  ...catalog,
  shared: { email: OWNER, isShared: () => true, browserCampaigns: async () => [], share: async () => { throw new Error('нет') } },
})

describe('ТЗ-3, этап 10: вход, онбординг, общая шапка', () => {
  it('shows a loading card, then «сервер недоступен · Повторить» — not the sign-in page — when the server does not answer', async () => {
    const user = userEvent.setup()
    const answers: CatalogState[] = [{ status: 'unreachable' }, { status: 'ready', catalog: signedIn(createLocalCampaignCatalog(new MemoryStorageGateway())) }]
    let release: () => void = () => {}
    const resolve = () => new Promise<CatalogState>((done) => { const next = answers.shift()!; release = () => done(next) })
    render(<Boot resolve={resolve}>{(catalog) => <p>Приложение для {catalog.shared?.email}</p>}</Boot>)
    expect(screen.getByRole('status')).toHaveTextContent('Подключаемся к серверу')
    release()
    expect(await screen.findByRole('heading', { name: 'Не удалось связаться с сервером' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Вход' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Повторить' }))
    release()
    expect(await screen.findByText(`Приложение для ${OWNER}`)).toBeInTheDocument()
  })

  it('shows the sign-in page only when nobody is signed in, with the dev hint as one text column', async () => {
    render(<Boot resolve={async () => ({ status: 'signed-out' })}>{() => null}</Boot>)
    expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument()
    const hint = document.querySelector('.sign-in__dev')!
    expect(hint.children).toHaveLength(2)
    expect(hint.lastElementChild).toHaveTextContent(/^Разработка: запустите npm run worker:dev/)
    const css = readFileSync(join(__dirname, '..', 'styles', 'home.css'), 'utf8')
    expect(css.match(/\.sign-in__dev\s*\{([^}]*)\}/)![1]).not.toMatch(/display:\s*flex/)
  })

  it.each([['/', 'Кампании'], ['/players', 'Игроки'], ['/backups', 'Резервные копии'], ['/import', 'Импорт']])(
    'has the shared home bar with «Выйти» on %s',
    async (path, heading) => {
      renderApp(path, signedIn(createLocalCampaignCatalog(new MemoryStorageGateway(), { seed: false })))
      expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument()
      const bar = document.querySelector('.campaign-workspace__topbar') as HTMLElement
      expect(within(bar).getByText(OWNER)).toBeInTheDocument()
      expect(within(bar).getByRole('link', { name: 'Выйти' })).toHaveAttribute('href', '/cdn-cgi/access/logout')
      expect(within(bar).getByRole('link', { name: /все кампании/ })).toHaveAttribute('href', '/')
      expect(bar.querySelector('[aria-label="Оформление интерфейса"]')).not.toBeNull()
    },
  )

  it('offers «Первая кампания» only while there are no campaigns, and drops the cover number', async () => {
    renderApp('/', createLocalCampaignCatalog(new MemoryStorageGateway(), { seed: false }))
    expect(await screen.findByRole('button', { name: /Первая кампания/ })).toBeInTheDocument()
    cleanup()
    const { catalog } = await readyCampaign()
    renderApp('/', catalog)
    const grid = await screen.findByRole('region', { name: 'Список кампаний' })
    await within(grid).findByRole('heading', { name: 'Город под стеклом' })
    expect(within(grid).queryByRole('button', { name: /кампания/ })).not.toBeInTheDocument()
    expect([...grid.querySelectorAll('.campaign-workspace__cover')].map((cover) => cover.textContent)).toContain('Г')
    expect([...grid.querySelectorAll('.campaign-workspace__cover')].every((cover) => !/\d/.test(cover.textContent ?? ''))).toBe(true)
  })

  it('does not offer «Первая кампания» when the list did not load', async () => {
    const catalog = createLocalCampaignCatalog(new MemoryStorageGateway(), { seed: false })
    renderApp('/', { ...catalog, load: async () => { throw new Error('Внутренняя ошибка') } })
    expect(await screen.findByText('Внутренняя ошибка')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Первая кампания/ })).not.toBeInTheDocument()
  })

  it('counts the same live sessions on a campaign card everywhere', async () => {
    const live = { ...blankSession(1, 'Сова', '2026-10-01T00:00:00Z'), title: 'Первая ночь' }
    const binned = { ...blankSession(2, 'Сова', '2026-10-02T00:00:00Z'), title: 'Черновик', deletedAt: '2026-10-03T00:00:00Z' }
    const { catalog } = await readyCampaign({ sessionRecords: [live, binned] })
    const archivedOne = await catalog.create('Старый маяк', '')
    await catalog.update({ ...archivedOne, archived: true, sessionRecords: [binned] })
    const binnedOnly = await catalog.create('Пустошь', '')
    await catalog.update({ ...binnedOnly, sessionRecords: [binned] })
    renderApp('/', catalog)
    const card = (await screen.findByRole('heading', { name: 'Город под стеклом' })).closest('article')!
    expect(within(card).getByText('1 сессия')).toBeInTheDocument()
    expect(within(card).getByText('Открыть кампанию')).toBeInTheDocument()
    const other = screen.getByRole('heading', { name: 'Пустошь' }).closest('article')!
    expect(within(other).getByText('Без сессий')).toBeInTheDocument()
    expect(within(other).getByText('Продолжить подготовку')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Архив кампаний' })).getByText(/Без сессий/)).toBeInTheDocument()
  })

  it('opens the world, team and ways in before session 1, and counts the library as a started world', async () => {
    const user = userEvent.setup()
    const catalog = createLocalCampaignCatalog(new MemoryStorageGateway(), { seed: false })
    const campaign = await catalog.create('Маяк', '')
    renderApp(`/local/campaign/${campaign.id}/overview`, catalog)
    expect(await screen.findByText('Мир пуст')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Разделы кампании' })
    expect(within(nav).queryByText(/Сессии/)).not.toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /Команда/ })).toBeInTheDocument()
    expect(document.querySelector('.campaign-topbar [aria-label="Оформление интерфейса"]')).not.toBeNull()
    await user.click(within(nav).getByRole('button', { name: /Мир/ }))
    expect(within(nav).getByRole('menuitem', { name: /Библиотека/ })).toBeInTheDocument()
    await user.click(within(nav).getByRole('button', { name: /Обмен/ }))
    expect(within(nav).getAllByRole('menuitem').map((item) => item.textContent?.trim())).toEqual(['Импорт', 'Интеграции'])

    await catalog.update({ ...(await catalog.find(campaign.id))!, entities: [newEntity({ id: 'olan', type: 'npc', name: 'Олан' })] })
    cleanup()
    renderApp(`/local/campaign/${campaign.id}/library`, catalog)
    expect(await screen.findByText('Олан')).toBeInTheDocument()
    cleanup()
    renderApp(`/local/campaign/${campaign.id}/session`, catalog)
    expect(await screen.findByText('Мир начат')).toBeInTheDocument()
    expect(screen.getByText(/В библиотеке 1 запись/)).toBeInTheDocument()
  })

  it('opens the import of a chosen campaign from the home «Импорт» page', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign()
    const { router } = renderApp('/import', catalog)
    const tile = await screen.findByRole('article', { name: 'Внутрь кампании' })
    await user.selectOptions(await within(tile).findByRole('combobox', { name: 'Кампания для импорта' }), id)
    await user.click(within(tile).getByRole('button', { name: 'Открыть импорт' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/local/campaign/${id}/import`))
  })

  it('creates a campaign by Enter in «Новая кампания»', async () => {
    const user = userEvent.setup()
    const catalog = createLocalCampaignCatalog(new MemoryStorageGateway(), { seed: false })
    renderApp('/', catalog)
    await user.click(await screen.findByRole('button', { name: 'Создать кампанию' }))
    await user.type(screen.getByLabelText('Название'), 'Маяк{Enter}')
    await waitFor(async () => expect((await catalog.load()).campaigns.map((item) => item.name)).toEqual(['Маяк']))
  })
})
