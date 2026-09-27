// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { createLocalCampaignCatalog } from '../local/catalog'
import { FakeBridge, LOREBOOK, SYSTEMSETUP } from '../test/fakeBridge'
import { readyCampaign, renderApp } from '../test/renderApp'

describe('integrations (ТЗ-2, R1/R3/R10)', () => {
  it('connects the world through the wizard and shows it as a fact', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/integrations`, catalog, new FakeBridge())
    const worldCard = await screen.findByRole('article', { name: 'Мир' })
    expect(within(worldCard).queryByRole('combobox')).not.toBeInTheDocument()
    await user.click(within(worldCard).getByRole('button', { name: 'Подключить' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(await within(dialog).findByRole('radio', { name: /Лунный порт/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Далее' }))
    expect(await within(dialog).findByText(/Лорбук отвечает/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Далее' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Существо → Мир' }))
    await user.click(within(dialog).getByRole('button', { name: 'Подключить' }))
    const linked = await screen.findByRole('article', { name: 'Мир' })
    expect(linked).toHaveTextContent('Лорбук · Лунный порт')
    expect(within(linked).getByRole('button', { name: 'Сменить' })).toBeInTheDocument()
    await waitFor(async () => {
      const saved = (await catalog.find(id))!
      expect(saved.integrations.lorebook).toMatchObject({ externalId: 'w-port', label: 'Лунный порт' })
      expect(saved.integrations.lorebook?.checkedAt).toBeTruthy()
      expect(saved.publishRules?.creature).toEqual(['table', 'world'])
    })
  })

  it('creates a campaign on a base and opens the choice of records', async () => {
    const user = userEvent.setup()
    const bridge = new FakeBridge()
    bridge.seed(LOREBOOK, { id: 'loc-1', type: 'location', name: 'Гавань' })
    bridge.seed(SYSTEMSETUP, { id: 'kk9-rules', type: 'system', name: 'Правила КК9' })
    const catalog = createLocalCampaignCatalog(new MemoryStorageGateway(), { seed: false })
    renderApp('/', catalog, bridge)
    await user.click(await screen.findByRole('button', { name: 'Создать кампанию' }))
    await user.click(await screen.findByRole('checkbox', { name: /Мир/ }))
    await user.click(screen.getByRole('checkbox', { name: /Система/ }))
    expect(screen.getByLabelText('Основа: Система')).toHaveValue('systemsetup:kk9-rules')
    await user.click(screen.getByRole('button', { name: 'Создать и выбрать записи' }))
    const dialog = await screen.findByRole('dialog', { name: 'Из источника' })
    await user.click(await within(dialog).findByRole('checkbox', { name: /Гавань/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Добавить 1 в библиотеку' }))
    expect(await within(dialog).findByText(/Добавлено в библиотеку: 1/)).toBeInTheDocument()
    const [campaign] = (await catalog.load()).campaigns
    expect(campaign.name).toBe('Лунный порт')
    expect(campaign.integrations).toMatchObject({ lorebook: { externalId: 'w-port' }, systemsetup: { externalId: 'kk9-rules', connectionId: 'packs' } })
    await waitFor(async () => expect((await catalog.find(campaign.id))!.entities.map((entity) => entity.name)).toEqual(['Гавань']))
  })

  it('queues a new entity where its type lives, and lets the card keep it only here', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ integrations: { lorebook: { externalId: 'w-port', label: 'Лунный порт' } } })
    renderApp(`/local/campaign/${id}/library`, catalog, new FakeBridge())
    await user.click(await screen.findByRole('button', { name: 'Новая сущность' }))
    await user.selectOptions(screen.getByLabelText('Тип'), 'location')
    await user.type(screen.getByLabelText('Название'), 'Гавань')
    expect(screen.getByRole('checkbox', { name: 'Мир · Лорбук' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    await user.click(await screen.findByRole('button', { name: 'Новая сущность' }))
    await user.selectOptions(screen.getByLabelText('Тип'), 'location')
    await user.type(screen.getByLabelText('Название'), 'Тайник')
    await user.click(screen.getByRole('checkbox', { name: 'Только здесь' }))
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () => {
      const saved = (await catalog.find(id))!
      expect(saved.entities.map((entity) => entity.name)).toEqual(['Гавань', 'Тайник'])
      expect(saved.entities[1].destinations).toEqual([])
      expect(saved.publications.map((item) => [saved.entities.find((entity) => entity.id === item.entityId)?.name, item.connectionId, item.targetType])).toEqual([['Гавань', 'lorebook:w-port', 'location']])
    })
  })
})
