// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newEntity } from '../local/domain'
import { newInboxItem } from '../local/inbox'
import { FakeBridge, LOREBOOK } from '../test/fakeBridge'
import { goToSection, readyCampaign, renderApp } from '../test/renderApp'

describe('import section and inbox triage (ТЗ-2, R6)', () => {
  it('imports from the linked world, logs it and opens the library filtered for sorting out', async () => {
    const user = userEvent.setup()
    const bridge = new FakeBridge()
    bridge.seed(LOREBOOK, { id: 'e1', type: 'lore', name: 'Хроника прилива' })
    const { catalog, id } = await readyCampaign({ integrations: { lorebook: { externalId: 'w-port', label: 'Лунный порт' } } })
    renderApp(`/local/campaign/${id}/overview`, catalog, bridge)
    await goToSection(user, 'Импорт')
    const world = await screen.findByRole('article', { name: 'Импорт: Мир' })
    expect(within(screen.getByRole('article', { name: 'Импорт: Стол' })).getByRole('link', { name: 'Подключить' })).toBeInTheDocument()
    await user.click(within(world).getByRole('button', { name: 'Выбрать записи' }))
    const dialog = await screen.findByRole('dialog', { name: 'Из источника' })
    await user.click(await within(dialog).findByRole('checkbox', { name: /Хроника прилива/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Добавить 1 в библиотеку' }))
    await user.click(within(dialog).getByRole('button', { name: 'Готово' }))
    const history = screen.getByRole('region', { name: 'История импорта' })
    expect(within(history).getByText('Мир · Лорбук · Лунный порт')).toBeInTheDocument()
    const tasks = screen.getByRole('region', { name: 'Разобрать после импорта' })
    const untagged = within(tasks).getByText('Без тегов').closest('li')!
    await user.click(within(untagged).getByRole('link', { name: 'Открыть' }))
    expect(await screen.findByRole('button', { name: 'Убрать фильтр: Без тегов' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Хроника прилива' })).toBeInTheDocument()
  })

  it('sorts a quick note into the library right on the overview', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ inbox: [newInboxItem('Мирта Солеварка #порт', '2026-09-27T12:00:00.000Z')], entities: [newEntity({ type: 'npc', name: 'Олан' })] })
    renderApp(`/local/campaign/${id}/overview`, catalog)
    const row = await screen.findByRole('group', { name: 'Разобрать: Мирта Солеварка' })
    await user.selectOptions(within(row).getByLabelText('Тип для «Мирта Солеварка»'), 'location')
    await user.click(within(row).getByRole('button', { name: 'В библиотеку' }))
    await waitFor(async () => {
      const saved = (await catalog.find(id))!
      expect(saved.inbox).toEqual([])
      expect(saved.entities.map((entity) => [entity.name, entity.type])).toContainEqual(['Мирта Солеварка', 'location'])
    })
  })

  it('imports a whole campaign from the import page', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign()
    const json = await catalog.exportCampaign(id)
    // jsdom's File has no text(); the browser one does.
    const file = Object.assign(new File([json], 'c.json', { type: 'application/json' }), { text: async () => json })
    const { router } = renderApp('/import', catalog)
    await user.upload(await screen.findByLabelText('Файл кампании для импорта'), file)
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/local\/campaign\/.+\/overview/))
    expect((await catalog.load()).campaigns.map((campaign) => campaign.name)).toContain('Город под стеклом (копия)')
  })
})
