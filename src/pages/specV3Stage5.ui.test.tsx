// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newArc, newClock, newEntity } from '../local/domain'
import { MemoryPlayersGateway } from '../local/players'
import type { CampaignCatalog } from '../local/remote'
import type { LocalCampaignRecord, LocalSessionPlanItem } from '../local/types'
import { readyCampaign, renderApp } from '../test/renderApp'

const item = (id: string, text: string, patch: Partial<LocalSessionPlanItem> = {}): LocalSessionPlanItem => ({ id, source: 'text', text, kind: 'note', priority: 'desired', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared', ...patch })

/** A campaign whose session 1 holds `planItems`. */
async function withPlan(planItems: LocalSessionPlanItem[], patch: Partial<LocalCampaignRecord> = {}) {
  const ready = await readyCampaign(patch)
  const campaign = (await ready.catalog.find(ready.id))!
  await ready.catalog.update({ ...campaign, sessionRecords: campaign.sessionRecords.map((session) => ({ ...session, planItems })) })
  return ready
}

const planOf = async (catalog: CampaignCatalog, id: string) => (await catalog.find(id))!.sessionRecords[0].planItems.map((entry) => entry.id)

describe('ТЗ-3, этап 5: удаление — подтверждение или отмена', () => {
  it('removes a lone plan item at once and brings it back with «Отменить»', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await withPlan([item('a', 'Олан'), item('b', 'Ставка')])
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Убрать Олан из сессии' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Пункт плана: Олан' })).not.toBeInTheDocument()
    await waitFor(async () => expect(await planOf(catalog, id)).toEqual(['b']))
    const toast = screen.getByText('«Олан» — из плана').closest('[role="status"]') as HTMLElement
    expect(within(toast).getByText('Удалено')).toBeInTheDocument()
    await user.click(within(toast).getByRole('button', { name: 'Отменить' }))
    expect(await screen.findByRole('article', { name: 'Пункт плана: Олан' })).toBeInTheDocument()
    expect(screen.queryByText('«Олан» — из плана')).not.toBeInTheDocument()
    await waitFor(async () => expect(await planOf(catalog, id)).toEqual(['a', 'b']))
  })

  it('asks before removing a scene with members and lists what happens to them', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await withPlan([item('scene', 'Порт', { kind: 'scene', priority: 'required' }), item('a', 'Олан', { sceneId: 'scene' })])
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Убрать Порт из сессии' }))
    let dialog = await screen.findByRole('dialog', { name: 'Убрать сцену «Порт» из плана?' })
    expect(within(dialog).getByText('1 пункт сцены («Олан») — останется в плане «вне сцен»')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Отмена' }))
    expect(screen.getByRole('region', { name: 'Сцена: Порт' })).toBeInTheDocument()
    expect(await planOf(catalog, id)).toEqual(['scene', 'a'])

    await user.click(screen.getByRole('button', { name: 'Убрать Порт из сессии' }))
    dialog = await screen.findByRole('dialog', { name: 'Убрать сцену «Порт» из плана?' })
    await user.click(within(dialog).getByRole('button', { name: 'Убрать' }))
    expect(screen.queryByRole('region', { name: 'Сцена: Порт' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Вне сцен' })).getByRole('article', { name: 'Пункт плана: Олан' })).toBeInTheDocument()
    await waitFor(async () => expect(await planOf(catalog, id)).toEqual(['a']))
    expect(screen.queryByText('Удалено')).not.toBeInTheDocument()
  })

  it('deletes an arc linked to a clock only after a question, and unlinks the clock', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ storyArcs: [newArc({ id: 'arc', title: 'Луна' })], clocks: [newClock({ id: 'k', title: 'Прилив', arcId: 'arc' })] })
    renderApp(`/local/campaign/${id}/arcs`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Редактировать линию: Луна' }))
    await user.click(screen.getByRole('button', { name: 'Удалить' }))
    const dialog = await screen.findByRole('dialog', { name: 'Удалить линию «Луна»?' })
    expect(within(dialog).getByText('Часы «Прилив» — отвяжутся от линии')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }))
    await waitFor(async () => {
      const saved = (await catalog.find(id))!
      expect(saved.storyArcs).toEqual([])
      expect(saved.clocks[0].arcId).toBe('')
    })
  })

  it('deletes a relation at once with «Отменить»', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({
      entities: [newEntity({ id: 'e', type: 'npc', name: 'Олан' }), newEntity({ id: 'f', type: 'faction', name: 'Гильдия' })],
      relations: [{ id: 'r', fromId: 'f', toId: 'e', label: 'нанимает', type: 'other', direction: 'directed', visibility: 'master' }],
    })
    renderApp(`/local/campaign/${id}/map`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Редактировать' }))
    await user.click(screen.getByRole('button', { name: 'Удалить' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))!.relations).toEqual([]))
    await user.click(screen.getByRole('button', { name: 'Отменить' }))
    await waitFor(async () => expect((await catalog.find(id))!.relations.map((relation) => relation.id)).toEqual(['r']))
  })

  it('asks before deleting a group that sessions are played for', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ players: [{ id: 'p', name: 'Аня', characterIds: [], note: '' }], groups: [{ id: 'g', name: 'Основная', playerIds: ['p'] }] })
    const campaign = (await catalog.find(id))!
    await catalog.update({ ...campaign, sessionRecords: campaign.sessionRecords.map((session) => ({ ...session, groupId: 'g' })) })
    renderApp(`/local/campaign/${id}/team`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Удалить группу Основная' }))
    const dialog = await screen.findByRole('dialog', { name: 'Удалить группу «Основная»?' })
    expect(within(dialog).getByText('Сессия №1 «Первая ночь» — останется без группы')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }))
    await waitFor(async () => {
      const saved = (await catalog.find(id))!
      expect(saved.groups).toEqual([])
      expect(saved.sessionRecords[0].groupId).toBe('')
    })
  })

  it('shows why «В справочник» failed and keeps the button usable', async () => {
    const user = userEvent.setup()
    class Offline extends MemoryPlayersGateway { override async save(): Promise<never> { throw new Error('Нет связи') } }
    const { catalog, id } = await readyCampaign({ players: [{ id: 'p', name: 'Аня', characterIds: [], note: '' }] })
    renderApp(`/local/campaign/${id}/team`, catalog, undefined, new Offline())
    const button = await screen.findByRole('button', { name: 'В справочник: Аня' })
    await user.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось добавить в справочник: Нет связи')
    expect(button).toBeEnabled()
    expect((await catalog.find(id))!.players[0].profileId).toBeUndefined()
  })

  it('says a master\'s email is wrong instead of dropping it silently', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ masters: [{ id: 'm-owl', name: 'Сова', role: 'owner', email: 'owl@example.com' }, { id: 'm-fox', name: 'Лис', role: 'co-master', email: 'fox@example.com' }] })
    const shared: CampaignCatalog = { ...catalog, shared: { email: 'owl@example.com', isShared: () => true, browserCampaigns: async () => [], share: async () => { throw new Error('не нужно') }, removeFromBrowser: async () => undefined } as unknown as NonNullable<CampaignCatalog['shared']> }
    renderApp(`/local/campaign/${id}/team`, shared)
    const email = await screen.findByLabelText('Почта мастера Лис')
    await user.clear(email)
    await user.type(email, 'лис-без-собаки')
    await user.tab()
    expect(await screen.findByRole('alert')).toHaveTextContent('«лис-без-собаки» не похоже на почту')
    expect(screen.getByRole('alert')).toHaveTextContent('Сохранена прежняя: fox@example.com.')
    expect((await catalog.find(id))!.masters[1].email).toBe('fox@example.com')

    await user.type(screen.getByLabelText('Имя нового мастера'), 'Ёж')
    await user.type(screen.getByLabelText('Почта нового мастера'), 'ёж@')
    await user.click(screen.getByRole('button', { name: 'Добавить мастера' }))
    expect(screen.getAllByRole('alert').some((alert) => alert.textContent?.includes('«ёж@» не похоже на почту'))).toBe(true)
    expect((await catalog.find(id))!.masters).toHaveLength(2)
  })

  it('bulk «Поле» starts empty, asks before clearing and before retyping a mixed pick', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities: [newEntity({ id: 'e', type: 'npc', name: 'Олан', fields: { motive: 'долг' } }), newEntity({ id: 'f', type: 'location', name: 'Порт' })] })
    renderApp(`/local/campaign/${id}/library`, catalog)
    await user.click(await screen.findByRole('button', { name: /Таблица/ }))
    await user.click(await screen.findByRole('checkbox', { name: 'Выбрать: Олан' }))
    const bar = screen.getByRole('region', { name: 'Действия с выбранными' })
    await user.click(within(bar).getByRole('button', { name: 'Поле' }))
    expect(within(bar).getByLabelText('Какое поле')).toHaveValue('')
    expect(within(bar).getByRole('button', { name: 'Применить к 1' })).toBeDisabled()
    await user.selectOptions(within(bar).getByLabelText('Какое поле'), 'motive')
    await user.click(within(bar).getByRole('button', { name: 'Применить к 1' }))
    let dialog = await screen.findByRole('dialog', { name: /^Очистить поле «.+» у 1 записи\?$/ })
    expect(within(dialog).getByText('Значение сотрётся у 1 из них.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Отмена' }))
    expect((await catalog.find(id))!.entities[0].fields.motive).toBe('долг')

    await user.click(screen.getByRole('checkbox', { name: 'Выбрать: Порт' }))
    await user.click(within(bar).getByRole('button', { name: 'Поле' }))
    await user.click(within(bar).getByRole('button', { name: 'Поле' }))
    await user.selectOptions(within(bar).getByLabelText('Какое поле'), '__type')
    expect(within(bar).getByLabelText('Новый тип')).toHaveValue('')
    expect(within(bar).getByRole('button', { name: 'Применить к 2' })).toBeDisabled()
    await user.selectOptions(within(bar).getByLabelText('Новый тип'), 'faction')
    await user.click(within(bar).getByRole('button', { name: 'Применить к 2' }))
    dialog = await screen.findByRole('dialog', { name: 'Сменить тип у 2 записей на «Фракция»?' })
    await user.click(within(dialog).getByRole('button', { name: 'Сменить тип' }))
    await waitFor(async () => expect((await catalog.find(id))!.entities.map((entity) => entity.type)).toEqual(['faction', 'faction']))
  })

  it('«По умолчанию» in sending rules lists what changes and asks first', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ publishRules: { npc: [] } })
    renderApp(`/local/campaign/${id}/integrations`, catalog)
    expect(screen.queryByRole('button', { name: 'Как было' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'По умолчанию' }))
    const dialog = await screen.findByRole('dialog', { name: 'Вернуть правила по умолчанию?' })
    expect(within(dialog).getByText('NPC: только здесь → стол')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Вернуть' }))
    await waitFor(async () => expect((await catalog.find(id))!.publishRules).toBeUndefined())
  })
})
