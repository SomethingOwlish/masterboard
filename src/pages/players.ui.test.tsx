// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryPlayersGateway, newProfile } from '../local/players'
import { FakeBridge } from '../test/fakeBridge'
import { readyCampaign, renderApp } from '../test/renderApp'

describe('shared player directory (ТЗ-2, R11)', () => {
  it('creates a profile with limits, availability and a private note', async () => {
    const user = userEvent.setup()
    const players = new MemoryPlayersGateway()
    renderApp('/players', undefined, new FakeBridge(), players)
    await user.type(await screen.findByLabelText('Найти игрока'), 'Ира')
    await user.click(screen.getByRole('button', { name: 'Добавить «Ира»' }))
    const profile = await screen.findByRole('region', { name: 'Профиль: Ира' })
    await user.type(within(profile).getByLabelText('Табу и границы'), 'пауки')
    await user.click(within(profile).getByRole('checkbox', { name: 'пт' }))
    await user.click(within(profile).getByRole('button', { name: 'Сохранить' }))
    await user.type(within(profile).getByLabelText(/Моя заметка/), 'Начинать с неё')
    await user.click(within(profile).getByRole('button', { name: 'Сохранить заметку' }))
    await waitFor(() => expect([...players.entries.values()][0]).toMatchObject({ profile: { name: 'Ира', limits: 'пауки', availability: { days: ['пт'] } }, revision: 2, myNote: 'Начинать с неё' }))
  })

  it('adds a directory player to a campaign and shows the campaign in the profile', async () => {
    const user = userEvent.setup()
    const players = new MemoryPlayersGateway()
    const ira = newProfile('Ира')
    await players.save(ira, 0)
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/team`, catalog, new FakeBridge(), players)
    await user.click(await screen.findByRole('button', { name: 'Из справочника' }))
    const dialog = await screen.findByRole('dialog', { name: 'Игроки из справочника' })
    await user.click(await within(dialog).findByRole('checkbox', { name: /Ира/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Добавить 1' }))
    expect(await screen.findByRole('link', { name: 'Профиль' })).toHaveAttribute('href', `/players?open=${ira.id}`)
    await waitFor(async () => expect((await catalog.find(id))!.players).toEqual([expect.objectContaining({ name: 'Ира', profileId: ira.id })]))
  })

  it('puts a campaign-only player into the directory', async () => {
    const user = userEvent.setup()
    const players = new MemoryPlayersGateway()
    const { catalog, id } = await readyCampaign({ players: [{ id: 'p', name: 'Тим', characterIds: [], note: 'любит бои' }] })
    renderApp(`/local/campaign/${id}/team`, catalog, new FakeBridge(), players)
    await user.click(await screen.findByRole('button', { name: 'В справочник: Тим' }))
    await waitFor(() => expect([...players.entries.values()][0].profile).toMatchObject({ name: 'Тим', notes: 'любит бои' }))
    await waitFor(async () => expect((await catalog.find(id))!.players[0].profileId).toBe([...players.entries.keys()][0]))
  })
})
