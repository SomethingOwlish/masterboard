// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { newSecret } from '../local/domain'
import { blankSession } from '../local/normalize'
import type { LocalSessionPlanItem } from '../local/types'
import { readyCampaign, renderApp, goToSection } from '../test/renderApp'

const OWL = { id: 'm-owl', name: 'Сова', role: 'owner' as const }
const FOX = { id: 'm-fox', name: 'Лис', role: 'co-master' as const }
const item: LocalSessionPlanItem = { id: 'p1', source: 'text', text: 'Ворота', kind: 'scene', priority: 'required', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared' }

async function teamCampaign() {
  return readyCampaign({
    masters: [OWL, FOX],
    players: [{ id: 'pl-ira', name: 'Ира', characterIds: [], note: '' }, { id: 'pl-tim', name: 'Тим', characterIds: [], note: '' }, { id: 'pl-lena', name: 'Лена', characterIds: [], note: '' }],
    groups: [{ id: 'g-main', name: 'Основная', playerIds: ['pl-ira', 'pl-tim'] }],
    sessionRecords: [{ ...blankSession(1, OWL.id, '2026-09-26T08:00:00.000Z', 's1'), title: 'Первая ночь', groupId: 'g-main', planItems: [item] }],
    activeSessionId: 's1',
    secrets: [newSecret({ id: 'sec', title: 'Цена', truth: 'Имена' })],
  })
}

beforeEach(() => window.localStorage.clear())

describe('stage 4: masters and permissions', () => {
  it('adds a co-master as the owner and hides management from a co-master', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await teamCampaign()
    renderApp(`/local/campaign/${id}/team`, catalog)
    await user.type(await screen.findByLabelText('Имя нового мастера'), 'Ёж{Enter}')
    const masters = screen.getByRole('region', { name: 'Мастера' })
    expect(within(masters).getByText('Ёж')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Кто работает в этом браузере'), FOX.id)
    expect(screen.queryByLabelText('Имя нового мастера')).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Управление кампанией' })).getByRole('note')).toHaveTextContent('Только владелец кампании (Сова)')
    await waitFor(async () => expect((await catalog.find(id))?.masters.map((master) => master.name)).toEqual(['Сова', 'Лис', 'Ёж']))
  })

  it('lets only the responsible master or the owner start a session', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await teamCampaign()
    renderApp(`/local/campaign/${id}/session`, catalog)
    expect(await screen.findByRole('button', { name: 'Начать' })).toBeEnabled()
    await user.selectOptions(screen.getByLabelText('Кто работает в этом браузере'), FOX.id)
    expect(screen.getByRole('button', { name: 'Начать' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Начать' })).toHaveAttribute('title', expect.stringContaining('ответственному мастеру (Сова)'))
  })

  it('records a handover when the responsible master changes', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await teamCampaign()
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Паспорт' }))
    await user.selectOptions(screen.getByLabelText('Ответственный мастер'), FOX.id)
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByText('Сова → Лис')).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0]).toMatchObject({ masterId: FOX.id, handovers: [{ fromId: OWL.id, toId: FOX.id, byId: OWL.id }] }))
  })

  it('archives the campaign from the team section', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await teamCampaign()
    const { router } = renderApp(`/local/campaign/${id}/team`, catalog)
    await user.click(await screen.findByRole('button', { name: 'В архив' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'В архив' }))
    await waitFor(async () => expect((await catalog.find(id))?.archived).toBe(true))
    await router.navigate('/')
    const archive = await screen.findByRole('region', { name: 'Архив кампаний' })
    expect(within(archive).getByText('Город под стеклом')).toBeInTheDocument()
  })
})

describe('stage 4: players and groups', () => {
  it('creates a player and a group, and invites a guest to the session', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await teamCampaign()
    renderApp(`/local/campaign/${id}/team`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Новый игрок' }))
    await user.type(screen.getByLabelText('Имя'), 'Марк')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    await user.click(screen.getByRole('button', { name: 'Новая группа' }))
    await user.type(screen.getByLabelText('Название'), 'Вторая партия')
    await user.click(within(screen.getByRole('dialog')).getByLabelText('Марк'))
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(within(screen.getByRole('region', { name: 'Группы' })).getByText('Вторая партия')).toBeInTheDocument()

    await goToSection(user, 'Сессии')
    await user.click(await screen.findByRole('button', { name: 'Паспорт' }))
    await user.click(within(screen.getByRole('dialog')).getByLabelText('Лена'))
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByText(/Основная · Ира, Тим, Лена/)).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].guestPlayerIds).toEqual(['pl-lena']))
  })

  it('reveals a secret to a group chosen from the pool', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await teamCampaign()
    renderApp(`/local/campaign/${id}/control`, catalog)
    await user.click(await screen.findByRole('button', { name: /Секреты/ }))
    await user.click(screen.getByRole('button', { name: 'Раскрыть…' }))
    await user.click(screen.getByLabelText('Группа «Основная»'))
    await user.click(screen.getByRole('button', { name: 'Записать' }))
    expect(await screen.findByText('Основная')).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.secrets[0]).toMatchObject({ recipientIds: ['g-main'], reveals: [{ recipientIds: ['g-main'] }] }))
  })
})
