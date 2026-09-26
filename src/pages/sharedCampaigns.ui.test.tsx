// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { createLocalCampaignCatalog, type LocalCampaignCatalog } from '../local/catalog'
import type { CampaignCatalog } from '../local/remote'
import { readyCampaign, renderApp } from '../test/renderApp'

const OWNER = 'owl@example.com'

/**
 * A signed-in catalog stand-in: `server` plays the Worker, `browser` holds
 * campaigns from before sign-in was required. The Worker itself is covered in worker/src.
 */
function signedIn(server: LocalCampaignCatalog, browser?: LocalCampaignCatalog, extra: Partial<NonNullable<CampaignCatalog['shared']>> = {}): CampaignCatalog {
  return {
    ...server,
    shared: {
      removeFromBrowser: (id) => browser!.remove(id),
      ...extra,
      email: OWNER,
      isShared: () => true,
      browserCampaigns: async () => browser ? (await browser.load()).campaigns : [],
      async share(id) {
        const campaign = (await browser!.find(id))!
        await browser!.remove(id)
        const created = await server.importCampaign(JSON.stringify({ format: 'masterboard-local-campaign/v1', campaign: { ...campaign, masters: campaign.masters.map((master) => master.role === 'owner' ? { ...master, email: OWNER } : master) } }))
        return created
      },
    },
  }
}

beforeEach(() => window.localStorage.clear())

describe('shared campaigns', () => {
  it('shows who is signed in and moves campaigns left in this browser to the server', async () => {
    const user = userEvent.setup()
    const server = createLocalCampaignCatalog(new MemoryStorageGateway(), { seed: false })
    const { catalog: browser } = await readyCampaign()
    renderApp('/', signedIn(server, browser))
    expect(await screen.findByText(OWNER)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Выйти' })).toHaveAttribute('href', '/cdn-cgi/access/logout')
    const banner = await screen.findByText(/В этом браузере/)
    expect(banner.closest('[role=status]')).toHaveTextContent('Город под стеклом')
    await user.click(screen.getByRole('button', { name: 'Перенести все' }))
    expect(await screen.findByRole('link', { name: /Город под стеклом/ })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(/В этом браузере/)).not.toBeInTheDocument())
    expect((await server.load()).campaigns.map((item) => item.masters[0].email)).toEqual([OWNER, OWNER])
    expect((await browser.load()).campaigns).toEqual([])
  })

  it('in a shared campaign the master comes from the sign-in and co-masters need an email', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ masters: [{ id: 'm-owl', name: 'Сова', role: 'owner', email: OWNER }] })
    renderApp(`/local/campaign/${id}/team`, signedIn(catalog))
    expect(await screen.findByText('Общая кампания')).toBeInTheDocument()
    const add = screen.getByRole('button', { name: 'Добавить мастера' })
    await user.type(screen.getByLabelText('Имя нового мастера'), 'Лис')
    expect(add).toBeDisabled()
    await user.type(screen.getByLabelText('Почта нового мастера'), 'Fox@Example.com')
    await user.click(add)
    await waitFor(async () => expect((await catalog.find(id))?.masters.map((master) => master.email)).toEqual([OWNER, 'fox@example.com']))
    expect(screen.queryByLabelText('Кто работает в этом браузере')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Почта мастера Лис')).toHaveValue('fox@example.com')
  })

  it('deletes campaigns left in this browser without moving them', async () => {
    const user = userEvent.setup()
    const server = createLocalCampaignCatalog(new MemoryStorageGateway(), { seed: false })
    const { catalog: browser } = await readyCampaign()
    renderApp('/', signedIn(server, browser))
    await screen.findByText(/В этом браузере/)
    await user.click(screen.getByRole('button', { name: 'Удалить все' }))
    await user.click(await screen.findByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(screen.queryByText(/В этом браузере/)).not.toBeInTheDocument())
    expect((await browser.load()).campaigns).toEqual([])
    expect((await server.load()).campaigns).toEqual([])
  })

  it('keeps edits in the browser while the server is unreachable and syncs them later', async () => {
    const user = userEvent.setup()
    const { catalog: server, id } = await readyCampaign()
    const browser = createLocalCampaignCatalog(new MemoryStorageGateway(), { seed: false })
    let offline = true
    const flaky: LocalCampaignCatalog = { ...server, update: (campaign) => offline ? Promise.reject(new Error('Failed to fetch')) : server.update(campaign) }
    renderApp(`/local/campaign/${id}/world`, signedIn(flaky, browser, { drafts: browser.drafts, saveDelayMs: 0 }))
    await user.type(await screen.findByLabelText('Новая опорная точка'), 'Факт{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('Правки сохранены в этом браузере')
    await waitFor(async () => expect((await browser.drafts.get(id))?.campaign.notes).toEqual(['Факт']))
    expect((await server.find(id))?.notes).toEqual([])
    offline = false
    await user.click(screen.getByRole('button', { name: 'Синхронизировать' }))
    await waitFor(async () => expect((await server.find(id))?.notes).toEqual(['Факт']))
    await waitFor(async () => expect(await browser.drafts.get(id)).toBeNull())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('restores unsynced edits after a reload and sends them', async () => {
    const { catalog: server, id } = await readyCampaign()
    const browser = createLocalCampaignCatalog(new MemoryStorageGateway(), { seed: false })
    const campaign = (await server.find(id))!
    await browser.drafts.set({ campaign: { ...campaign, notes: ['Из черновика'] }, baseRevision: 0, base: null, savedAt: campaign.updatedAt })
    renderApp(`/local/campaign/${id}/world`, signedIn(server, browser, { drafts: browser.drafts, saveDelayMs: 0 }))
    expect(await screen.findByText('Из черновика')).toBeInTheDocument()
    await waitFor(async () => expect((await server.find(id))?.notes).toEqual(['Из черновика']))
    await waitFor(async () => expect(await browser.drafts.get(id)).toBeNull())
  })

  it('writes a burst of edits to the server once', async () => {
    const user = userEvent.setup()
    const { catalog: server, id } = await readyCampaign()
    let writes = 0
    const counting: LocalCampaignCatalog = { ...server, update: (campaign) => { writes += 1; return server.update(campaign) } }
    renderApp(`/local/campaign/${id}/world`, signedIn(counting, undefined, { saveDelayMs: 300 }))
    const input = await screen.findByLabelText('Новая опорная точка')
    await user.type(input, 'Раз{Enter}')
    await user.type(input, 'Два{Enter}')
    await user.type(input, 'Три{Enter}')
    await waitFor(async () => expect((await server.find(id))?.notes).toEqual(['Раз', 'Два', 'Три']))
    expect(writes).toBe(1)
  })
})
