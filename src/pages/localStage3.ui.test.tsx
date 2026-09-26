// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newEntity } from '../local/domain'
import { blankSession } from '../local/normalize'
import type { LocalSessionPlanItem } from '../local/types'
import { readyCampaign, renderApp } from '../test/renderApp'

const planItem = (id: string, text: string, patch: Partial<LocalSessionPlanItem> = {}): LocalSessionPlanItem => ({ id, source: 'text', text, kind: 'note', priority: 'desired', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared', ...patch })

async function planCampaign(items: LocalSessionPlanItem[]) {
  const session = { ...blankSession(1, 'Сова', '2026-09-26T08:00:00.000Z', 'session-1'), title: 'Первая ночь', planItems: items }
  return readyCampaign({ sessionRecords: [session], activeSessionId: 'session-1' })
}

const dataTransfer = (id: string) => ({ getData: () => id, setData: () => undefined, effectAllowed: 'move' })
const typed = (payload: Record<string, string>) => ({ getData: (type: string) => payload[type] ?? '', setData: () => undefined, effectAllowed: 'move' })

describe('stage 3: plan', () => {
  it('groups items as alternatives and skips the rest when one is played', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await planCampaign([planItem('a', 'Через ворота'), planItem('b', 'Через канализацию')])
    renderApp(`/local/campaign/${id}/session`, catalog)
    for (const title of ['Через ворота', 'Через канализацию']) {
      const card = await screen.findByRole('article', { name: `Пункт плана: ${title}` })
      await user.click(within(card).getByRole('button', { name: `Показать подробности: ${title}` }))
      await user.type(within(card).getByLabelText(`Группа «или-или»: ${title}`), 'вход{Enter}')
    }
    await user.selectOptions(screen.getByLabelText('Статус Через ворота'), 'used')
    expect(screen.getByLabelText('Статус Через канализацию')).toHaveValue('skipped')
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].planItems.map((item) => [item.alternative, item.status])).toEqual([['вход', 'used'], ['вход', 'skipped']]))
  })

  it('adds a transition with a condition', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await planCampaign([planItem('a', 'Ворота', { kind: 'scene' }), planItem('b', 'Погоня', { kind: 'scene' })])
    renderApp(`/local/campaign/${id}/session`, catalog)
    const flows = await screen.findByRole('region', { name: 'Переходы' })
    await user.selectOptions(within(flows).getByLabelText('Переход из'), 'a')
    await user.selectOptions(within(flows).getByLabelText('Переход в'), 'b')
    await user.type(within(flows).getByLabelText('Условие перехода'), 'стража подняла тревогу')
    await user.click(within(flows).getByRole('button', { name: 'Добавить переход' }))
    expect(within(flows).getByText(/Ворота → Погоня/)).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].flows[0]).toMatchObject({ fromItemId: 'a', toItemId: 'b', condition: 'стража подняла тревогу' }))
  })

  it('drags an item into another priority column', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await planCampaign([planItem('a', 'Ворота', { priority: 'desired' })])
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'По приоритету' }))
    const column = await screen.findByRole('region', { name: 'Запас' })
    fireEvent.drop(column, { dataTransfer: dataTransfer('a') })
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].planItems[0].priority).toBe('backup'))
    expect(within(column).getByRole('article', { name: 'Пункт плана: Ворота' })).toBeInTheDocument()
  })

  it('places items into scenes of the scene tree', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await planCampaign([planItem('scene', 'У ворот', { kind: 'scene' }), planItem('npc', 'Стражник', { kind: 'npc' }), planItem('map', 'Карта', { kind: 'material' })])
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Показать подробности: Стражник' }))
    await user.selectOptions(screen.getByLabelText('Сцена: Стражник'), 'scene')
    const scene = screen.getByRole('region', { name: 'Сцена: У ворот' })
    expect(within(scene).getByText('Стражник')).toBeInTheDocument()
    fireEvent.drop(scene, { dataTransfer: dataTransfer('map') })
    expect(await within(scene).findByText('Карта')).toBeInTheDocument()
    await user.selectOptions(within(scene).getByLabelText('Сцена: Стражник'), '')
    expect(within(screen.getByRole('region', { name: 'Вне сцен' })).getByText('Стражник')).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].planItems.map((item) => item.sceneId)).toEqual([undefined, undefined, 'scene']))
  })

  it('keeps priority as a status of scenes and items, and saves notes only on submit', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await planCampaign([planItem('s', 'У ворот', { kind: 'scene', priority: 'required' }), planItem('n', 'Стражник', { sceneId: 's' })])
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.selectOptions(await screen.findByLabelText('Приоритет У ворот'), 'useful')
    await user.selectOptions(screen.getByLabelText('Приоритет Стражник'), 'backup')
    await user.click(screen.getByText('Комментарий и связи сцены'))
    await user.type(screen.getByLabelText('Комментарий к сцене У ворот'), 'Ночь, дождь')
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].planItems.map((item) => item.priority)).toEqual(['useful', 'backup']))
    expect((await catalog.find(id))?.sessionRecords[0].planItems[0].note).toBe('')
    await user.click(screen.getByRole('button', { name: 'Сохранить: Комментарий к сцене У ворот' }))
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].planItems[0].note).toBe('Ночь, дождь'))
  })

  it('adds library records straight into a scene, from the scene or by dragging from the panel', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await planCampaign([planItem('s', 'У ворот', { kind: 'scene' })])
    const campaign = (await catalog.find(id))!
    await catalog.update({ ...campaign, entities: [newEntity({ id: 'e1', type: 'npc', name: 'Олан', description: 'Смотритель маяка' }), newEntity({ id: 'e2', type: 'item', name: 'Компас' }), newEntity({ id: 'e3', type: 'location', name: 'Гавань' })] })
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Добавить из библиотеки в сцену У ворот' }))
    expect(screen.getByLabelText('Куда добавить')).toHaveValue('s')
    await user.click(screen.getByRole('checkbox', { name: /Олан/ }))
    await user.click(screen.getByRole('checkbox', { name: /Компас/ }))
    await user.click(screen.getByRole('button', { name: 'Добавить (2)' }))
    const scene = screen.getByRole('region', { name: 'Сцена: У ворот' })
    expect(within(scene).getByText('Олан')).toBeInTheDocument()
    expect(within(scene).getByText('Компас')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Добавить в план' }))
    fireEvent.drop(screen.getByRole('region', { name: 'Вне сцен' }), { dataTransfer: typed({ 'text/plan-source': 'entity:e3' }) })
    expect(await within(screen.getByRole('region', { name: 'Вне сцен' })).findByText('Гавань')).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].planItems.map((item) => [item.entityId, item.sceneId])).toEqual([[undefined, undefined], ['e1', 's'], ['e2', 's'], ['e3', undefined]]))
  })

  it('shows a library record inside the plan and edits it in the library', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await planCampaign([planItem('p', 'Олан', { source: 'library', entityId: 'e1', kind: 'npc' })])
    const campaign = (await catalog.find(id))!
    await catalog.update({ ...campaign, entities: [newEntity({ id: 'e1', type: 'npc', name: 'Олан', description: 'Смотритель маяка', tags: ['маяк'] })] })
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Показать подробности: Олан' }))
    expect(screen.getByText('#маяк')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Редактировать запись: Олан' }))
    const description = screen.getByLabelText('Рабочее описание')
    await user.clear(description)
    await user.type(description, 'Бывший контрабандист')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByText('Бывший контрабандист')).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.entities[0].description).toBe('Бывший контрабандист'))
  })

  it('shows forks on the timeline and opens the transitions graph', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await planCampaign([planItem('intro', 'Прибытие', { kind: 'scene' }), planItem('l', 'Рынок', { kind: 'scene', alternative: 'путь' }), planItem('r', 'Доки', { kind: 'scene', alternative: 'путь' })])
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Временная линия' }))
    const fork = screen.getByRole('listitem', { name: 'Развилка: путь' })
    expect(within(fork).getByText('Рынок')).toBeInTheDocument()
    expect(within(fork).getByText('Доки')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Граф переходов' }))
    expect(await screen.findByLabelText('Граф переходов')).toBeInTheDocument()
  })
})
