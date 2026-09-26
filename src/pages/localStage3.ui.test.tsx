// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { blankSession } from '../local/normalize'
import type { LocalSessionPlanItem } from '../local/types'
import { readyCampaign, renderApp } from '../test/renderApp'

const planItem = (id: string, text: string, patch: Partial<LocalSessionPlanItem> = {}): LocalSessionPlanItem => ({ id, source: 'text', text, kind: 'note', priority: 'desired', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared', ...patch })

async function planCampaign(items: LocalSessionPlanItem[]) {
  const session = { ...blankSession(1, 'Сова', '2026-09-26T08:00:00.000Z', 'session-1'), title: 'Первая ночь', planItems: items }
  return readyCampaign({ sessionRecords: [session], activeSessionId: 'session-1' })
}

const dataTransfer = (id: string) => ({ getData: () => id, setData: () => undefined, effectAllowed: 'move' })

describe('stage 3: plan', () => {
  it('groups items as alternatives and skips the rest when one is played', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await planCampaign([planItem('a', 'Через ворота'), planItem('b', 'Через канализацию')])
    renderApp(`/local/campaign/${id}/session`, catalog)
    for (const title of ['Через ворота', 'Через канализацию']) {
      const card = await screen.findByRole('article', { name: `Пункт плана: ${title}` })
      await user.click(within(card).getByText('Связи пункта'))
      await user.type(within(card).getByLabelText(`Группа «или-или»: ${title}`), 'вход')
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
    const { catalog, id } = await planCampaign([planItem('a', 'Ворота', { priority: 'desired' })])
    renderApp(`/local/campaign/${id}/session`, catalog)
    const column = await screen.findByRole('region', { name: 'Запас' })
    fireEvent.drop(column, { dataTransfer: dataTransfer('a') })
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].planItems[0].priority).toBe('backup'))
    expect(within(column).getByRole('article', { name: 'Пункт плана: Ворота' })).toBeInTheDocument()
  })

  it('places items into scenes on the scene board', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await planCampaign([planItem('scene', 'У ворот', { kind: 'scene' }), planItem('npc', 'Стражник', { kind: 'npc' }), planItem('map', 'Карта', { kind: 'material' })])
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Доска сцен' }))
    await user.selectOptions(screen.getByLabelText('Сцена: Стражник'), 'scene')
    const scene = screen.getByRole('region', { name: 'Сцена: У ворот' })
    expect(within(scene).getByText('Стражник')).toBeInTheDocument()
    fireEvent.drop(scene, { dataTransfer: dataTransfer('map') })
    expect(await within(scene).findByText('Карта')).toBeInTheDocument()
    await user.click(within(scene).getByRole('button', { name: 'Убрать Стражник из сцены' }))
    expect(within(screen.getByRole('region', { name: 'Без сцены' })).getByText('Стражник')).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].planItems.map((item) => item.sceneId)).toEqual([undefined, undefined, 'scene']))
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
