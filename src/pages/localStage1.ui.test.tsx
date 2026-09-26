// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newArc, newClock, newEntity, newSecret } from '../local/domain'
import { readyCampaign, renderApp } from '../test/renderApp'

describe('stage 1: arcs', () => {
  it('pauses an arc only with a reason and shows it on the card', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ storyArcs: [newArc({ id: 'arc-1', title: 'Договор', status: 'active' })] })
    renderApp(`/local/campaign/${id}/arcs`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Редактировать линию: Договор' }))
    await user.selectOptions(screen.getByLabelText('Состояние'), 'paused')
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled()
    await user.type(screen.getByLabelText(/Почему линия приостановлена/), 'Игроки уехали на север')
    await user.selectOptions(screen.getByLabelText('Режим'), 'background')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    const paused = await screen.findByRole('region', { name: 'На паузе' })
    expect(within(paused).getByText('Игроки уехали на север')).toBeInTheDocument()
    expect(within(paused).getByText('Фон')).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.storyArcs[0]).toMatchObject({ status: 'paused', statusReason: 'Игроки уехали на север', mode: 'background' }))
  })
})

describe('stage 1: clocks', () => {
  it('confirms the trigger when a clock fills and adds a consequence task', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ clocks: [newClock({ id: 'clock-1', title: 'Прилив', segments: 4, value: 3, trigger: 'Город затоплен' })] })
    renderApp(`/local/campaign/${id}/control`, catalog)
    await user.type(await screen.findByLabelText('Причина движения: Прилив'), 'Ночь без договора')
    await user.click(screen.getByRole('button', { name: '+ Продвинуть' }))
    const dialog = await screen.findByRole('dialog', { name: 'Часы заполнены: Прилив' })
    expect(within(dialog).getByText('Город затоплен')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Сработало' }))
    expect(await screen.findByText('Сработали')).toBeInTheDocument()
    await waitFor(async () => {
      const saved = await catalog.find(id)
      expect(saved?.clocks[0]).toMatchObject({ value: 4, triggerStatus: 'fired' })
      expect(saved?.tasks.map((task) => task.text)).toEqual(['Последствие часов «Прилив»: Город затоплен'])
    })
  })

  it('can defer the confirmation and confirm later', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ clocks: [newClock({ id: 'clock-1', title: 'Прилив', segments: 4, value: 3, trigger: 'Город затоплен' })] })
    renderApp(`/local/campaign/${id}/control`, catalog)
    await user.type(await screen.findByLabelText('Причина движения: Прилив'), 'Ночь')
    await user.click(screen.getByRole('button', { name: '+ Продвинуть' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Отложить' }))
    expect(await screen.findByText('Ждут подтверждения')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Подтвердить срабатывание' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Сработало' }))
    expect(await screen.findByText('Сработали')).toBeInTheDocument()
  })

  it('announces a threshold with its consequence', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ clocks: [newClock({ id: 'clock-1', title: 'Прилив', segments: 6, value: 1, thresholds: [{ id: 't', at: 2, consequence: 'Лестницы под водой' }] })] })
    renderApp(`/local/campaign/${id}/control`, catalog)
    await user.type(await screen.findByLabelText('Причина движения: Прилив'), 'Ночь')
    await user.click(screen.getByRole('button', { name: '+ Продвинуть' }))
    const dialog = await screen.findByRole('dialog', { name: 'Отметка часов: Прилив' })
    expect(within(dialog).getByText('Лестницы под водой')).toBeInTheDocument()
    await user.click(within(dialog).getByLabelText('Добавить последствия в задачи ведущего'))
    await user.click(within(dialog).getByRole('button', { name: 'Понятно' }))
    await waitFor(async () => expect((await catalog.find(id))?.clocks[0].thresholds[0].reachedAt).toBeTruthy())
    expect((await catalog.find(id))?.tasks).toEqual([])
  })

  it('saves conditions, thresholds and links from the editor', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities: [newEntity({ id: 'e1', type: 'npc', name: 'Олан' })], storyArcs: [newArc({ id: 'arc-1', title: 'Договор' })] })
    renderApp(`/local/campaign/${id}/control`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Новые часы' }))
    await user.type(screen.getByLabelText('Название'), 'Прилив')
    await user.type(screen.getByLabelText('Когда продвигать'), 'Каждую ночь')
    await user.click(screen.getByRole('button', { name: 'Добавить отметку' }))
    await user.type(screen.getByLabelText('Последствие отметки 1'), 'Рынок закрыт')
    await user.selectOptions(screen.getByLabelText('Сюжетная линия'), 'arc-1')
    await user.click(screen.getByLabelText('Олан'))
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () => expect((await catalog.find(id))?.clocks[0]).toMatchObject({ advanceCondition: 'Каждую ночь', arcId: 'arc-1', entityIds: ['e1'], thresholds: [{ at: 3, consequence: 'Рынок закрыт' }] }))
  })
})

describe('stage 1: secrets', () => {
  it('records a reveal with the session in the history', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ secrets: [newSecret({ id: 's1', title: 'Цена', truth: 'Имена' })] })
    renderApp(`/local/campaign/${id}/control`, catalog)
    await user.click(await screen.findByRole('button', { name: /Секреты/ }))
    await user.click(screen.getByRole('button', { name: 'Раскрыть…' }))
    await user.selectOptions(screen.getByLabelText('Новое состояние'), 'selected')
    await user.type(screen.getByLabelText('Кому ещё известно'), 'Ира')
    await user.selectOptions(screen.getByLabelText('В какой сессии'), screen.getByRole('option', { name: /№1 Первая ночь/ }))
    await user.click(screen.getByRole('button', { name: 'Записать' }))
    expect(await screen.findByText('История раскрытий · 1')).toBeInTheDocument()
    const saved = (await catalog.find(id))!.secrets[0]
    expect(saved).toMatchObject({ status: 'selected', recipients: 'Ира' })
    expect(saved.reveals[0].sessionId).toBe(saved.sessionIds[0])
  })

  it('links a secret to a session plan item', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ secrets: [newSecret({ id: 's1', title: 'Цена договора', truth: 'Имена', revealCondition: 'Найти договор' })] })
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Из библиотеки' }))
    await user.click(screen.getByRole('checkbox', { name: /Цена договора/ }))
    await user.click(screen.getByRole('button', { name: 'Добавить (1)' }))
    expect(screen.getByRole('article', { name: 'Пункт плана: Цена договора' })).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].planItems[0]).toMatchObject({ kind: 'secret', secretId: 's1' }))
  })

  it('turns a free-text secret item into a campaign secret', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Добавить в план' }))
    await user.selectOptions(screen.getByLabelText('Тип пункта плана'), 'secret')
    await user.type(screen.getByLabelText('Свободный текст пункта плана'), 'Капитан — шпион{Enter}')
    await user.click(screen.getByRole('button', { name: 'Показать подробности: Капитан — шпион' }))
    await user.click(screen.getByRole('button', { name: 'В секреты' }))
    await waitFor(async () => {
      const saved = (await catalog.find(id))!
      expect(saved.secrets.map((secret) => secret.title)).toEqual(['Капитан — шпион'])
      expect(saved.sessionRecords[0].planItems[0].secretId).toBe(saved.secrets[0].id)
    })
  })
})

describe('stage 1: library', () => {
  it('archives entities out of view and filters by type', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities: [newEntity({ id: 'e1', type: 'npc', name: 'Олан' }), newEntity({ id: 'e2', type: 'location', name: 'Гавань' })] })
    renderApp(`/local/campaign/${id}/library`, catalog)
    const olan = (await screen.findByRole('heading', { name: 'Олан' })).closest('article')!
    await user.click(within(olan as HTMLElement).getByRole('button', { name: 'В архив' }))
    expect(screen.queryByRole('heading', { name: 'Олан' })).not.toBeInTheDocument()
    await user.click(screen.getByLabelText(/Показать архив/))
    expect(screen.getByRole('heading', { name: 'Олан' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Тип сущности'), 'location')
    expect(screen.queryByRole('heading', { name: 'Олан' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Гавань' })).toBeInTheDocument()
  })

  it('saves type-specific fields, visibility and shows the origin', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/library`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Новая сущность' }))
    await user.type(screen.getByLabelText('Название'), 'Олан')
    await user.type(screen.getByLabelText('Мотив'), 'Искупить старую сделку')
    await user.selectOptions(screen.getByLabelText('Видимость'), 'public')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByText('Искупить старую сделку')).toBeInTheDocument()
    expect(screen.getByText('Создано вручную')).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.entities[0]).toMatchObject({ fields: { motive: 'Искупить старую сделку' }, visibility: 'public', origin: { kind: 'manual' } }))
  })
})
