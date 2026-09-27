// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newClock, newEntity, newSecret } from '../local/domain'
import { blankSession } from '../local/normalize'
import type { LocalSessionPlanItem } from '../local/types'
import { readyCampaign, renderApp } from '../test/renderApp'

const NOW = '2026-09-27T08:00:00.000Z'
const planItem = (id: string, entityId: string): LocalSessionPlanItem => ({ id, source: 'library', entityId, text: '', kind: 'npc', priority: 'required', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared' })

describe('ТЗ-3, этап 2: печать, сущности, связи, часы', () => {
  it('labels secrets on the overview by their status', async () => {
    const { catalog, id } = await readyCampaign({
      secrets: [newSecret({ id: 's1', title: 'Цена', truth: 'Имена', status: 'everyone' }), newSecret({ id: 's2', title: 'Шпион', truth: 'Капитан', status: 'hidden' })],
    })
    renderApp(`/local/campaign/${id}/overview`, catalog)
    const cost = (await screen.findByRole('button', { name: 'Цена' })).closest('article')!
    expect(within(cost).getByText('Всем героям')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: 'Шпион' }).closest('article')!).getByText('Не раскрыт')).toBeInTheDocument()
    expect(screen.getByText('Не раскрыт: 1')).toBeInTheDocument()
  })

  it('moves fields by label when the type changes in the editor', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities: [newEntity({ id: 'olan', type: 'npc', name: 'Олан', dead: true, fields: { role: 'Фонарщик', motive: 'Искупление' } })] })
    renderApp(`/local/campaign/${id}/library`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Редактировать: Олан' }))
    await user.selectOptions(screen.getByLabelText('Тип'), 'location')
    // NPC slots are gone; their values travel on under their labels in «Из основы».
    expect(document.getElementById('local-entity-field-motive')).toBeNull()
    expect(screen.getByLabelText('Атмосфера')).toHaveValue('')
    expect(screen.getByLabelText('Мотив')).toHaveValue('Искупление')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () => {
      const saved = (await catalog.find(id))!.entities[0]
      expect(saved.type).toBe('location')
      expect(saved.fields).toEqual({ 'Роль в истории': 'Фонарщик', 'Мотив': 'Искупление' })
      expect(saved.dead).toBeUndefined()
    })
  })

  it('deletes an entity used only by a trashed session and cleans every reference', async () => {
    const user = userEvent.setup()
    const trashed = { ...blankSession(2, 'Сова', NOW, 'session-2'), title: 'Маяк', deletedAt: NOW, planItems: [planItem('p1', 'olan')] }
    const { catalog, id } = await readyCampaign({
      entities: [newEntity({ id: 'olan', type: 'npc', name: 'Олан' })],
      players: [{ id: 'p-ann', name: 'Аня', characterIds: ['olan'], note: '' }],
      publications: [
        { id: 'q-ready', entityId: 'olan', entityType: 'npc', connectionId: 'lb', operation: 'create', patch: {}, state: 'ready', createdAt: NOW },
        { id: 'q-sent', entityId: 'olan', entityType: 'npc', connectionId: 'lb', operation: 'create', patch: {}, state: 'succeeded', createdAt: NOW },
      ],
    })
    const campaign = (await catalog.find(id))!
    await catalog.update({ ...campaign, sessionRecords: [...campaign.sessionRecords, trashed] })
    renderApp(`/local/campaign/${id}/library`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Редактировать: Олан' }))
    const remove = screen.getByRole('button', { name: 'Удалить' })
    expect(remove).toBeEnabled()
    await user.click(remove)
    await waitFor(async () => {
      const saved = (await catalog.find(id))!
      expect(saved.entities).toEqual([])
      expect(saved.players[0].characterIds).toEqual([])
      expect(saved.publications.map((item) => item.id)).toEqual(['q-sent'])
      expect(saved.sessionRecords.find((session) => session.id === 'session-2')!.planItems[0]).toMatchObject({ source: 'text', text: 'Олан', entityId: undefined })
    })
  })

  it('opens a session from the side panel by URL, without changing the active session', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities: [newEntity({ id: 'olan', type: 'npc', name: 'Олан' })] })
    const campaign = (await catalog.find(id))!
    const first = campaign.sessionRecords[0]
    const second = { ...blankSession(2, 'Сова', NOW, 'session-2'), title: 'Маяк', planItems: [planItem('p1', 'olan')] }
    await catalog.update({ ...campaign, sessionRecords: [first, second], activeSessionId: first.id })
    const { router } = renderApp(`/local/campaign/${id}/library`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Олан' }))
    const panel = await screen.findByRole('complementary', { name: /Олан/ })
    await user.click(within(panel).getByRole('button', { name: '№2 Маяк' }))
    await user.click(within(await screen.findByRole('complementary', { name: 'Сессия №2: Маяк' })).getByRole('button', { name: 'Открыть сессию' }))
    expect(router.state.location.search).toBe('?session=session-2')
    expect(await screen.findByRole('heading', { name: 'Маяк', level: 1 })).toBeInTheDocument()
    expect((await catalog.find(id))!.activeSessionId).toBe(first.id)
  })

  it('opens the search by the K key on any layout', async () => {
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/overview`, catalog)
    await screen.findByRole('navigation', { name: 'Разделы кампании' })
    fireEvent.keyDown(window, { key: 'л', code: 'KeyK', ctrlKey: true })
    expect(await screen.findByLabelText('Что ищем')).toBeInTheDocument()
  })

  it('keeps an archived end of a relation choosable and marked', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({
      entities: [newEntity({ id: 'a', type: 'npc', name: 'Олан' }), newEntity({ id: 'b', type: 'npc', name: 'Мира' }), newEntity({ id: 'c', type: 'location', name: 'Маяк', status: 'archived' })],
      relations: [{ id: 'r1', fromId: 'a', toId: 'c', label: 'сторожит', type: 'other', direction: 'directed', visibility: 'master' }],
    })
    renderApp(`/local/campaign/${id}/map`, catalog)
    const relation = await screen.findByRole('article', { name: /сторожит/ })
    await user.click(within(relation).getByRole('button', { name: /Редактировать|Изменить/ }))
    const to = screen.getByLabelText('К кому') as HTMLSelectElement
    expect(to.value).toBe('c')
    expect(within(to).getByRole('option', { name: 'Маяк (в архиве)' })).toBeInTheDocument()
  })

  it('cancels the clock dialog on Escape and the backdrop without tasks or a deferred trigger', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ clocks: [newClock({ id: 'tide', title: 'Прилив', segments: 4, value: 3, trigger: 'Город затоплен' })] })
    renderApp(`/local/campaign/${id}/control?tab=clocks`, catalog)
    await user.type(await screen.findByLabelText('Причина движения: Прилив'), 'Ночь прошла')
    await user.click(screen.getByRole('button', { name: '+ Продвинуть' }))
    const dialog = await screen.findByRole('dialog', { name: 'Часы заполнены: Прилив' })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Часы заполнены: Прилив' })).not.toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))!.clocks[0].value).toBe(4))
    let saved = (await catalog.find(id))!
    expect(saved.clocks[0].triggerStatus).toBe('idle')
    expect(saved.tasks).toEqual([])
    // The decision is still reachable from the card; a backdrop click cancels it again.
    await user.click(screen.getByRole('button', { name: 'Подтвердить срабатывание' }))
    fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Часы заполнены: Прилив' }).parentElement!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    saved = (await catalog.find(id))!
    expect(saved.clocks[0].triggerStatus).toBe('idle')
    expect(saved.tasks).toEqual([])
  })

  it('warns that fewer segments drop a threshold and shows it out of range', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ clocks: [newClock({ id: 'tide', title: 'Прилив', segments: 8, thresholds: [{ id: 't6', at: 6, consequence: 'Рынок закрыт' }] })] })
    renderApp(`/local/campaign/${id}/control?tab=clocks`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Редактировать часы: Прилив' }))
    await user.selectOptions(screen.getByLabelText('Сегментов'), '4')
    expect(screen.getByText('Отметка 6 будет удалена: в часах 4 сегментов.')).toBeInTheDocument()
    const threshold = screen.getByLabelText('Сегмент отметки 1') as HTMLSelectElement
    expect(threshold.value).toBe('6')
    expect(threshold.selectedOptions[0].textContent).toBe('6 — за шкалой')
  })

  it('says «Погиб» once in the side panel and on the entity page', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities: [newEntity({ id: 'olan', type: 'npc', name: 'Олан', dead: true })] })
    renderApp(`/local/campaign/${id}/library`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Олан' }))
    const panel = await screen.findByRole('complementary', { name: /Олан/ })
    expect(within(panel).getAllByText('Погиб')).toHaveLength(1)
    await user.click(within(panel).getByRole('button', { name: 'Открыть полностью' }))
    await screen.findByRole('heading', { name: 'Олан', level: 2 })
    expect(screen.getAllByText('Погиб')).toHaveLength(1)
  })
})
