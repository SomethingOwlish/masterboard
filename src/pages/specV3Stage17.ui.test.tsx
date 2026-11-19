// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newArc, newSecret } from '../local/domain'
import { normalizeCampaign } from '../local/normalize'
import { arcOwnerName } from '../local/team'
import { readyCampaign, renderApp } from '../test/renderApp'

const AT = '2026-11-19T10:00:00.000Z'
const masters = [{ id: 'm-owl', name: 'Сова', role: 'owner' as const }]
const players = [{ id: 'p-ira', name: 'Ира', characterIds: [] as string[], note: '' }]

describe('ТЗ-3, этап 17: секреты, линии, lint', () => {
  it('migrates a text arc owner to a link by name, and keeps other text as «прочее»', () => {
    const campaign = normalizeCampaign({
      id: 'c', name: 'К', masters, players,
      storyArcs: [
        { id: 'a1', title: 'Договор', owner: 'сова' },
        { id: 'a2', title: 'Наследник', owner: ' Ира ' },
        { id: 'a3', title: 'Гильдия', owner: 'Гильдия фонарщиков' },
        { id: 'a4', title: 'Ушедший', ownerRef: { kind: 'player', id: 'p-gone' }, owner: 'Лис' },
      ],
    }, AT)!
    const [owl, ira, guild, gone] = campaign.storyArcs
    expect(owl).toMatchObject({ ownerRef: { kind: 'master', id: 'm-owl' }, owner: '' })
    expect(ira).toMatchObject({ ownerRef: { kind: 'player', id: 'p-ira' }, owner: '' })
    expect(guild).toMatchObject({ owner: 'Гильдия фонарщиков' })
    expect(guild.ownerRef).toBeUndefined()
    expect(gone.ownerRef).toBeUndefined()
    expect(campaign.storyArcs.map((arc) => arcOwnerName(campaign, arc))).toEqual(['Сова', 'Ира', 'Гильдия фонарщиков', 'Лис'])
  })

  it('picks the arc owner from the masters and players, or types someone else', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ players, storyArcs: [newArc({ id: 'heir', title: 'Наследник', status: 'active' })] })
    renderApp(`/local/campaign/${id}/arcs`, catalog)
    await user.click(await screen.findByRole('button', { name: /Редактировать.*Наследник|Наследник/ }))
    const dialog = await screen.findByRole('dialog')
    const owner = within(dialog).getByLabelText('Владелец линии')
    expect(within(owner).getByRole('option', { name: 'Ира' })).toBeInTheDocument()
    await user.selectOptions(owner, 'player:p-ira')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () => expect((await catalog.find(id))!.storyArcs[0]).toMatchObject({ ownerRef: { kind: 'player', id: 'p-ira' }, owner: '' }))

    await user.click(await screen.findByRole('button', { name: /Редактировать.*Наследник|Наследник/ }))
    const again = await screen.findByRole('dialog')
    await user.selectOptions(within(again).getByLabelText('Владелец линии'), 'other')
    await user.type(within(again).getByLabelText('Кто ведёт (не мастер и не игрок)'), 'Гильдия')
    await user.click(within(again).getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () => {
      const arc = (await catalog.find(id))!.storyArcs[0]
      expect(arc.owner).toBe('Гильдия')
      expect(arc.ownerRef).toBeUndefined()
    })
  })

  it('names the free-text recipients of a secret «Кому ещё (не игроки)», next to players and groups', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ players, secrets: [newSecret({ id: 's1', title: 'Крот' })] })
    renderApp(`/local/campaign/${id}/control?tab=secrets`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Новый секрет' }))
    const dialog = await screen.findByRole('dialog')
    const list = within(dialog).getByRole('group', { name: 'Кому известно: группы и игроки' })
    const others = within(dialog).getByLabelText('Кому ещё (не игроки)')
    expect(list.compareDocumentPosition(others) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(dialog).queryByLabelText('Кому ещё известно')).not.toBeInTheDocument()
  })

  it('warns on JSX lines longer than 160 characters', () => {
    const config = readFileSync(join(__dirname, '../../.eslintrc.cjs'), 'utf8')
    expect(config).toMatch(/files: \['\*\.tsx'\][\s\S]*'max-len': \['warn', \{ code: 160, ignoreComments: true, ignoreUrls: true/)
  })
})
