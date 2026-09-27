// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { newClock, newEntity, newSecret } from '../local/domain'
import { blankSession } from '../local/normalize'
import type { LocalSessionPlanItem } from '../local/types'
import { readyCampaign, renderApp } from '../test/renderApp'

const planItem = (id: string, text: string, patch: Partial<LocalSessionPlanItem> = {}): LocalSessionPlanItem => ({ id, source: 'text', text, kind: 'scene', priority: 'required', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared', ...patch })

async function printCampaign() {
  const session = {
    ...blankSession(1, 'Сова', '2026-09-26T08:00:00.000Z', 'session-1'), title: 'Первая ночь', focus: 'Найти договор',
    planItems: [
      planItem('scene', 'У ворот', { note: 'Стража нервничает' }),
      planItem('npc', 'Олан', { source: 'library', entityId: 'e-olan', kind: 'npc', priority: 'desired' }),
      planItem('map', 'Карта порта', { source: 'library', entityId: 'e-map', kind: 'material', priority: 'useful' }),
      planItem('s-open', 'Цена', { secretId: 's-open', kind: 'secret', priority: 'backup' }),
      planItem('s-hidden', 'Шпион', { secretId: 's-hidden', kind: 'secret', priority: 'backup' }),
    ],
  }
  return readyCampaign({
    sessionRecords: [session], activeSessionId: 'session-1',
    entities: [newEntity({ id: 'e-olan', type: 'npc', name: 'Олан', fields: { motive: 'Искупление' } }), newEntity({ id: 'e-map', type: 'map', name: 'Карта порта', visibility: 'public', description: 'Три причала и маяк' })],
    secrets: [newSecret({ id: 's-open', title: 'Цена', truth: 'Имена горожан', publicVersion: 'Договор требует жертвы', status: 'partial' }), newSecret({ id: 's-hidden', title: 'Шпион', truth: 'Капитан — шпион', publicVersion: 'Кто-то доносит', status: 'hidden' })],
    clocks: [newClock({ id: 'c1', title: 'Прилив', value: 2, segments: 4, visibility: 'public' })],
  })
}

describe('print', () => {
  it('builds the director sheet and follows the print configuration', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await printCampaign()
    renderApp(`/local/campaign/${id}/print`, catalog)
    const sheet = await screen.findByRole('article', { name: 'Режиссёрский лист' })
    expect(within(sheet).getByRole('heading', { name: 'Сессия 1: Первая ночь' })).toBeInTheDocument()
    expect(within(sheet).getByText('Стража нервничает')).toBeInTheDocument()
    expect(within(sheet).getByText('Капитан — шпион')).toBeInTheDocument()
    expect(within(sheet).getByText(/Искупление/)).toBeInTheDocument()
    await user.click(screen.getByLabelText('Секреты'))
    await user.click(screen.getByLabelText('Запас'))
    expect(within(sheet).queryByText('Капитан — шпион')).not.toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].printConfig).toMatchObject({ secrets: false, priorities: ['required', 'desired', 'useful'] }))
  })

  it('shows players only public entities, revealed secrets and public clocks', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await printCampaign()
    renderApp(`/local/campaign/${id}/print`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Материалы игроков' }))
    const sheet = screen.getByRole('article', { name: 'Материалы игроков' })
    expect(within(sheet).getByText('Три причала и маяк')).toBeInTheDocument()
    expect(within(sheet).getByText('Договор требует жертвы')).toBeInTheDocument()
    expect(within(sheet).queryByText('Цена')).not.toBeInTheDocument()
    expect(within(sheet).getByText('Прилив')).toBeInTheDocument()
    expect(within(sheet).queryByText('Олан')).not.toBeInTheDocument()
    expect(within(sheet).queryByText('Кто-то доносит')).not.toBeInTheDocument()
    expect(within(sheet).queryByText('Имена горожан')).not.toBeInTheDocument()
  })

  it('opens the browser print dialog', async () => {
    const user = userEvent.setup()
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const { catalog, id } = await printCampaign()
    renderApp(`/local/campaign/${id}/print`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Печать' }))
    expect(print).toHaveBeenCalled()
    print.mockRestore()
  })
})
