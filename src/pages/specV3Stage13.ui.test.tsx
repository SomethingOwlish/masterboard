// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newEntity } from '../local/domain'
import { newInboxItem } from '../local/inbox'
import { blankSession } from '../local/normalize'
import { sameForPublishing } from '../local/integration'
import { FakeBridge } from '../test/fakeBridge'
import { readyCampaign, renderApp } from '../test/renderApp'

const STYLES = join(__dirname, '..')
const css = [join(STYLES, 'index.css'), ...readdirSync(join(STYLES, 'styles')).map((name) => join(STYLES, 'styles', name))]
  .map((file) => readFileSync(file, 'utf8')).join('\n')
const AT = '2026-11-19T10:00:00.000Z'

describe('ТЗ-3, этап 13: публикация — панель сверху', () => {
  it('puts the steps in a sticky bar above the queue and selects every ready item at once', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({
      entities: [newEntity({ id: 'olan', type: 'npc', name: 'Олан' }), newEntity({ id: 'gran', type: 'npc', name: 'Гран', visibility: 'master' })],
      integrations: { lorebook: { externalId: 'w-port', label: 'Лунный порт' } },
    })
    renderApp(`/local/campaign/${id}/publish`, catalog, new FakeBridge())
    for (const entity of ['olan', 'gran']) {
      await user.selectOptions(await screen.findByLabelText('Что публикуем'), entity)
      await user.click(screen.getByRole('button', { name: 'В очередь' }))
    }
    const bar = screen.getByRole('toolbar', { name: 'Шаги публикации' })
    const queue = await screen.findByRole('list', { name: 'Очередь публикации' })
    expect(bar.compareDocumentPosition(queue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(within(bar).getByRole('button', { name: '1. Проверить' }))
    const selectAll = await within(bar).findByRole('button', { name: 'Выбрать все готовые (2)' })
    await user.click(selectAll)
    expect(within(queue).getByLabelText('Выбрать: Олан → Мир · Лорбук · Лунный порт')).toBeChecked()
    expect(within(queue).getByLabelText('Выбрать: Гран → Мир · Лорбук · Лунный порт')).toBeChecked()
    await user.click(within(bar).getByRole('button', { name: '2. Подтвердить (2)' }))
    expect(within(bar).getByRole('button', { name: '3. Отправить подтверждённые (2)' })).toBeEnabled()
    await waitFor(async () => expect((await catalog.find(id))!.publications.every((item) => item.confirmedAt)).toBe(true))
  })

  it('warns at a master-only item right in the queue', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({
      entities: [newEntity({ id: 'gran', type: 'npc', name: 'Гран', visibility: 'master' })],
      integrations: { lorebook: { externalId: 'w-port', label: 'Лунный порт' } },
    })
    renderApp(`/local/campaign/${id}/publish`, catalog, new FakeBridge())
    await user.selectOptions(await screen.findByLabelText('Что публикуем'), 'gran')
    await user.click(screen.getByRole('button', { name: 'В очередь' }))
    const queue = await screen.findByRole('list', { name: 'Очередь публикации' })
    expect(within(queue).getByText(/^Только мастерам:/)).toBeInTheDocument()
  })

  it('keeps the bar sticky at the top', () => {
    expect(css).toMatch(/\.publish-section__bar\s*\{[^}]*position:\s*sticky;\s*top:\s*0/)
  })

  it('treats a save without changes as nothing to queue', () => {
    const entity = newEntity({ type: 'npc', name: 'Олан', fields: { motive: 'Искупление', look: 'Седой' } })
    const reordered = { ...entity, fields: { look: 'Седой', motive: 'Искупление' } }
    expect(sameForPublishing(entity, reordered)).toBe(true)
    expect(sameForPublishing(entity, { ...entity, name: 'Олан Старший' })).toBe(false)
    expect(sameForPublishing(entity, { ...entity, destinations: ['world'] })).toBe(false)
    expect(sameForPublishing(entity, { ...entity, status: 'archived' })).toBe(true)
  })
})

describe('ТЗ-3, этап 13: единые Входящие', () => {
  const items = Array.from({ length: 8 }, (_, index) => newInboxItem(`Запись ${index + 1}`, AT))

  it('shows the latest six on the Overview with a link to all of them', async () => {
    const user = userEvent.setup()
    const session = { ...blankSession(1, 'Сова', AT, 's1'), title: 'Первая' }
    const { catalog, id } = await readyCampaign({ inbox: items, sessionRecords: [session], activeSessionId: 's1' })
    renderApp(`/local/campaign/${id}/overview`, catalog)
    const list = await screen.findByRole('list', { name: 'Разобрать входящие' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(6)
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Запись 8')
    await user.click(screen.getByRole('button', { name: 'Все входящие · 8' }))
    const all = await screen.findByRole('list', { name: 'Разобрать входящие' })
    await waitFor(() => expect(within(all).getAllByRole('listitem')).toHaveLength(8))
  })

  it('has the same field, type choice and actions in the Control panel', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ inbox: [newInboxItem('Мирта', AT)] })
    renderApp(`/local/campaign/${id}/control?tab=inbox`, catalog)
    const row = await screen.findByRole('group', { name: 'Разобрать: Мирта' })
    await user.selectOptions(within(row).getByLabelText('Тип для «Мирта»'), 'location')
    await user.click(within(row).getByRole('button', { name: 'В библиотеку' }))
    await waitFor(async () => expect((await catalog.find(id))!.entities.map((entity) => [entity.name, entity.type])).toEqual([['Мирта', 'location']]))
    await user.type(screen.getByLabelText('Быстрая запись'), 'Шторм #погода{Enter}')
    await waitFor(async () => expect((await catalog.find(id))!.inbox).toMatchObject([{ text: 'Шторм', tags: ['погода'] }]))
    expect(await screen.findByRole('button', { name: 'Удалить: Шторм' })).toBeInTheDocument()
  })
})
