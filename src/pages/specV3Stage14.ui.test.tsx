// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { createLocalCampaignCatalog } from '../local/catalog'
import { newEntity, newNote, NOTE_NAME_LIMIT } from '../local/domain'
import { newInboxItem } from '../local/inbox'
import { blankSession, normalizeCampaign } from '../local/normalize'
import { readyCampaign, renderApp } from '../test/renderApp'

const AT = '2026-11-19T10:00:00.000Z'
const session = () => ({ ...blankSession(1, 'Сова', AT, 's1'), title: 'Первая' })

describe('ТЗ-3, этап 14: заметки как сущности', () => {
  it('turns old string notes into note entities, with stable ids', () => {
    const raw = { id: 'c', name: 'Старая', notes: ['Прилив по ночам', '', 'Гильдия хранит договор'], entities: [] }
    const once = normalizeCampaign(raw, AT)!
    expect(once).not.toHaveProperty('notes')
    expect(once.entities.map((entity) => [entity.type, entity.name])).toEqual([['note', 'Прилив по ночам'], ['note', 'Гильдия хранит договор']])
    // A second load (or another master) migrates to the same records, not to copies.
    const again = normalizeCampaign({ ...raw, entities: once.entities }, AT)!
    expect(again.entities.map((entity) => entity.id)).toEqual(once.entities.map((entity) => entity.id))
  })

  it('keeps a long note whole in the description', () => {
    const text = 'Очень длинная заметка '.repeat(10).trim()
    const note = newNote(text)
    expect(note.name.length).toBeLessThanOrEqual(NOTE_NAME_LIMIT)
    expect(note.name.endsWith('…')).toBe(true)
    expect(note.description).toBe(text)
  })

  it('shows migrated notes in the section and in the library, and survives export and import', async () => {
    const storage = new MemoryStorageGateway()
    const catalog = createLocalCampaignCatalog(storage, { seed: false })
    const created = await catalog.create('Старая кампания', '')
    // An old record straight from storage: notes as strings.
    await catalog.update({ ...created, sessionRecords: [session()], activeSessionId: 's1', notes: ['Прилив по ночам'] } as typeof created)
    const loaded = (await catalog.find(created.id))!
    expect(loaded.entities.map((entity) => entity.name)).toEqual(['Прилив по ночам'])

    renderApp(`/local/campaign/${created.id}/world`, catalog)
    expect(await screen.findByRole('heading', { name: 'Заметки' })).toBeInTheDocument()
    expect(screen.getByText('Прилив по ночам')).toBeInTheDocument()

    const file = await catalog.exportCampaign(created.id)
    const copy = await catalog.importCampaign(file)
    expect(copy.entities.map((entity) => [entity.type, entity.name])).toEqual([['note', 'Прилив по ночам']])
  })

  it('is the library filtered to notes, with a quick field', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({
      sessionRecords: [session()], activeSessionId: 's1',
      entities: [newNote('Слух о маяке', { id: 'n1' }), newEntity({ id: 'olan', type: 'npc', name: 'Олан' })],
    })
    renderApp(`/local/campaign/${id}/world`, catalog)
    expect(await screen.findByText('Слух о маяке')).toBeInTheDocument()
    expect(screen.queryByText('Олан')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Тип сущности')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Новая заметка'), 'Туман приходит с юга{Enter}')
    expect(await screen.findByText('Туман приходит с юга')).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))!.entities.filter((entity) => entity.type === 'note').map((entity) => entity.name)).toEqual(['Слух о маяке', 'Туман приходит с юга']))

    renderApp(`/local/campaign/${id}/library`, catalog)
    const library = await screen.findByRole('heading', { name: 'Библиотека' })
    const section = library.closest('section')!
    expect(within(section).getByText('Туман приходит с юга')).toBeInTheDocument()
    expect(within(section).getByText('Олан')).toBeInTheDocument()
  })

  it('makes «В заметку» from the inbox a note entity with its tags', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ inbox: [newInboxItem('Шторм #погода', AT)] })
    renderApp(`/local/campaign/${id}/control?tab=inbox`, catalog)
    const row = await screen.findByRole('group', { name: 'Разобрать: Шторм' })
    await user.click(within(row).getByRole('button', { name: 'В заметку' }))
    await waitFor(async () => expect((await catalog.find(id))!.entities).toMatchObject([{ type: 'note', name: 'Шторм', tags: ['погода'], origin: { kind: 'inbox' } }]))
  })

  it('writes onboarding notes as entities', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ sessionRecords: [], activeSessionId: undefined })
    renderApp(`/local/campaign/${id}/overview`, catalog)
    await user.type(await screen.findByLabelText('Новая опорная точка'), 'Город под стеклом{Enter}')
    await waitFor(async () => expect((await catalog.find(id))!.entities).toMatchObject([{ type: 'note', name: 'Город под стеклом' }]))
    expect(await screen.findByText('Мир начат')).toBeInTheDocument()
  })
})
