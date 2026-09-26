// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { blankSession } from '../local/normalize'
import { readyCampaign, renderApp } from '../test/renderApp'

const OWL = { id: 'm-owl', name: 'Сова', role: 'owner' as const }
const FOX = { id: 'm-fox', name: 'Лис', role: 'co-master' as const }

beforeEach(() => window.localStorage.clear())

describe('stage 4: personal overview layout', () => {
  it('hides and reorders overview blocks for the acting master only', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ masters: [OWL, FOX] })
    renderApp(`/local/campaign/${id}/overview`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Настроить обзор' }))
    await user.click(within(screen.getByRole('toolbar', { name: 'Блок «Входящие»' })).getByRole('button', { name: 'Скрыть' }))
    await user.click(screen.getByRole('button', { name: 'Выше: Часы' }))
    await user.click(screen.getByRole('button', { name: 'Готово' }))
    expect(screen.queryByRole('heading', { name: 'Входящие' })).not.toBeInTheDocument()
    const order = [...document.querySelectorAll('[data-widget]')].map((node) => node.getAttribute('data-widget'))
    expect(order).toEqual(['session', 'clocks', 'arcs', 'secrets', 'tasks'])
    await user.selectOptions(screen.getByLabelText('Кто работает в этом браузере'), FOX.id)
    expect(screen.getByRole('heading', { name: 'Входящие' })).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.dashboardLayouts[OWL.id]).toMatchObject({ hidden: ['inbox'] }))
  })

  it('resets the layout', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ masters: [OWL, FOX], dashboardLayouts: { [OWL.id]: { order: ['inbox', 'session', 'arcs', 'clocks', 'secrets', 'tasks'], hidden: ['arcs'], wide: [] } } })
    renderApp(`/local/campaign/${id}/overview`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Настроить обзор' }))
    await user.click(screen.getByRole('button', { name: 'Сбросить раскладку' }))
    await waitFor(async () => expect((await catalog.find(id))?.dashboardLayouts).toEqual({}))
    expect(screen.getByRole('heading', { name: 'Активные линии' })).toBeInTheDocument()
  })
})

describe('stage 4: improv sheet', () => {
  it('keeps a personal sheet and uses an item from the live panel', async () => {
    const user = userEvent.setup()
    const session = { ...blankSession(1, OWL.id, '2026-09-26T08:00:00.000Z', 's1'), title: 'Первая ночь', status: 'active' as const }
    const { catalog, id } = await readyCampaign({ masters: [OWL, FOX], sessionRecords: [session], activeSessionId: 's1' })
    const { router } = renderApp(`/local/campaign/${id}/improv`, catalog)
    await user.selectOptions(await screen.findByLabelText('Вид заготовки'), 'npc')
    await user.type(screen.getByLabelText('Текст заготовки'), 'Мирта Солеварка{Enter}')
    expect(screen.getByText('Мирта Солеварка')).toBeInTheDocument()

    await router.navigate(`/local/campaign/${id}/play`)
    const panel = await screen.findByLabelText('Живая панель')
    await user.click(within(panel).getByRole('button', { name: /Заготовки/ }))
    await user.click(within(panel).getByRole('button', { name: 'Использовать заготовку Мирта Солеварка' }))
    await waitFor(async () => {
      const saved = (await catalog.find(id))!
      expect(saved.entities[0]).toMatchObject({ name: 'Мирта Солеварка', origin: { kind: 'improv', sessionId: 's1' } })
      expect(saved.sessionRecords[0].log.at(-1)?.text).toContain('Мирта Солеварка')
      expect(saved.improv[0].usedSessionId).toBe('s1')
    })
    await user.selectOptions(screen.getByLabelText('Кто работает в этом браузере'), FOX.id)
    await user.click(within(screen.getByLabelText('Живая панель')).getByRole('button', { name: /Заготовки/ }))
    expect(within(screen.getByLabelText('Живая панель')).getByText(/Личный лист Лис пуст/)).toBeInTheDocument()
  })
})
