// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { createLocalCampaignCatalog } from '../local/catalog'
import type { CampaignCatalog } from '../local/remote'
import { ExternalError } from '../local/external'
import { FakeBridge } from '../test/fakeBridge'
import { renderApp } from '../test/renderApp'

beforeEach(() => window.localStorage.clear())

describe('резервные копии (М5)', () => {
  it('показывают, что копии ещё не было, и делают её по кнопке любому мастеру', async () => {
    const user = userEvent.setup()
    const bridge = new FakeBridge()
    renderApp('/backups', undefined, bridge)
    expect(await screen.findByText(/Ещё не было/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Папка «мастерборд» в GitHub/ })).toHaveAttribute('href', bridge.backup.folder)
    await user.click(screen.getByRole('button', { name: 'Сделать сейчас' }))
    expect(await screen.findByText('Копия записана')).toBeInTheDocument()
    expect(screen.getByText(/вручную: owl@example.com/)).toBeInTheDocument()
    expect(bridge.backupRuns).toBe(1)
  })

  it('говорит вслух, что копия не прошла, и почему', async () => {
    const user = userEvent.setup()
    const bridge = new FakeBridge()
    bridge.backupFails = true
    renderApp('/backups', undefined, bridge)
    await user.click(await screen.findByRole('button', { name: 'Сделать сейчас' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Копия не прошла.*Masterboard отказал \(401\)/)
  })

  it('не подключённый мост — не ошибка, а объяснение, и кнопка гаснет', async () => {
    const bridge = new FakeBridge()
    bridge.backupStatus = async () => { throw new ExternalError('Связь с внешними системами не настроена', 501, 'unconfigured') }
    renderApp('/backups', undefined, bridge)
    expect(await screen.findByText('Резервная копия не подключена.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сделать сейчас' })).toBeDisabled()
  })

  it('открываются со списка кампаний у вошедшего мастера', async () => {
    const user = userEvent.setup()
    const server = createLocalCampaignCatalog(new MemoryStorageGateway(), { seed: false })
    const catalog: CampaignCatalog = { ...server, shared: { email: 'owl@example.com', isShared: () => true, browserCampaigns: async () => [], share: async () => { throw new Error('нет') } } }
    const { router } = renderApp('/', catalog as never)
    await user.click(await screen.findByRole('link', { name: 'Резервные копии' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/backups'))
  })
})
