// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newEntity } from '../local/domain'
import { readyCampaign, renderApp } from '../test/renderApp'

describe('batch manager', () => {
  it('queues, checks, confirms, sends, and retries after a simulated outage', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities: [newEntity({ id: 'npc', type: 'npc', name: 'Олан' }), newEntity({ id: 'key', type: 'item', name: 'Ключ' })] })
    renderApp(`/local/campaign/${id}/publish`, catalog)
    for (const entity of ['npc', 'key']) {
      await user.selectOptions(await screen.findByLabelText('Что публикуем'), entity)
      await user.click(screen.getByRole('button', { name: 'В очередь' }))
    }
    await user.click(screen.getByLabelText('Лорбук мира (тест) не отвечает'))
    await user.click(screen.getByRole('button', { name: '1. Проверить черновики' }))
    const queue = await screen.findByRole('list', { name: 'Очередь публикации' })
    expect(await within(queue).findByText('Лорбук пока не принимает предметы')).toBeInTheDocument()
    await user.click(within(queue).getByLabelText('Выбрать: Олан → Лорбук мира (тест)'))
    await user.click(screen.getByRole('button', { name: '2. Подтвердить выбранные' }))
    await user.click(screen.getByRole('button', { name: '3. Отправить подтверждённые (1)' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Отправить' }))
    expect(await screen.findByText('Отправлено: 0. Ошибок: 1.')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Лорбук мира (тест) не отвечает'))
    await user.click(within(queue).getByLabelText('Выбрать: Олан → Лорбук мира (тест)'))
    await user.click(screen.getByRole('button', { name: 'Повторить выбранные' }))
    await user.click(screen.getByRole('button', { name: '3. Отправить подтверждённые (1)' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Отправить' }))
    expect(await screen.findByText('Отправлено: 1. Ошибок: 0.')).toBeInTheDocument()
    expect(screen.getByText('История отправок · 1')).toBeInTheDocument()
    await waitFor(async () => expect((await catalog.find(id))?.publications.map((item) => item.state)).toEqual(['succeeded', 'blocked']))
  })
})
