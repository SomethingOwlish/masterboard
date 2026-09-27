// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { createLocalCampaignCatalog } from '../local/catalog'
import { newEntity } from '../local/domain'
import { enqueue } from '../local/publishing'
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

describe('integrations and the queue (ТЗ-3, этап 3)', () => {
  const WORLD = { lorebook: { externalId: 'w-port', label: 'Лунный порт' } }

  it('unlinking the world blocks what waited in the queue for it, with the reason', async () => {
    const user = userEvent.setup()
    const entity = newEntity({ id: 'loc', type: 'location', name: 'Гавань' })
    const { catalog, id } = await readyCampaign({ entities: [entity], integrations: WORLD })
    const saved = (await catalog.find(id))!
    await catalog.update(enqueue(saved, 'loc', LOREBOOK, 'create', saved.createdAt, 'location'))
    renderApp(`/local/campaign/${id}/integrations`, catalog, new FakeBridge())
    await user.click(within(await screen.findByRole('article', { name: 'Мир' })).getByRole('button', { name: 'Отвязать' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('1 элемент очереди туда будет заблокирован.')
    await user.click(within(dialog).getByRole('button', { name: 'Отвязать' }))
    await user.click(await screen.findByRole('link', { name: '«Публикация»' }))
    const queue = await screen.findByRole('list', { name: 'Очередь публикации' })
    expect(within(queue).getByText('Заблокировано')).toBeInTheDocument()
    expect(within(queue).getByText(/Подключение отвязано от кампании/)).toBeInTheDocument()
    expect(within(queue).getByRole('checkbox')).toBeDisabled()
    expect(within(queue).getByRole('checkbox')).toHaveAttribute('title', expect.stringContaining('Заблокировано: Подключение отвязано'))
    expect(screen.getByRole('button', { name: '3. Отправить подтверждённые (0)' })).toBeDisabled()
  })

  it('keeps a failed check on the card and checks again on «Проверить»', async () => {
    const user = userEvent.setup()
    const bridge = new FakeBridge()
    const passport = bridge.passports[LOREBOOK]
    delete bridge.passports[LOREBOOK]
    const { catalog, id } = await readyCampaign({ integrations: WORLD })
    renderApp(`/local/campaign/${id}/integrations`, catalog, bridge)
    const card = await screen.findByRole('article', { name: 'Мир' })
    expect(card).toHaveTextContent('Связь ещё не проверялась')
    await user.click(within(card).getByRole('button', { name: 'Проверить' }))
    expect(await within(card).findByText(/Проверка не прошла .*: Нет такого подключения/)).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))!.integrations.lorebook).toMatchObject({ checkError: 'Нет такого подключения' }))

    bridge.passports[LOREBOOK] = passport
    await user.click(within(card).getByRole('button', { name: 'Проверить' }))
    expect(await within(card).findByText(/Связь проверена/)).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))!.integrations.lorebook?.checkError).toBeUndefined())
  })

  it('says in the wizard which link a new one replaces', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ integrations: { lorebook: { externalId: 'w-old', label: 'Старый мир' } } })
    renderApp(`/local/campaign/${id}/integrations`, catalog, new FakeBridge())
    await user.click(within(await screen.findByRole('article', { name: 'Мир' })).getByRole('button', { name: 'Сменить' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText(/будет отвязан/)).not.toBeInTheDocument()
    await user.click(await within(dialog).findByRole('radio', { name: /Лунный порт/ }))
    expect(within(dialog).getByRole('note')).toHaveTextContent('Лорбук «Старый мир» будет отвязан.')
  })
})
