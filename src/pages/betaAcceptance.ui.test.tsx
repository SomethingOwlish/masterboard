// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { createLocalCampaignCatalog } from '../local/catalog'
import { renderApp } from '../test/renderApp'

beforeEach(() => window.localStorage.clear())

/** The whole GM loop of the local beta, as one person would walk it. */
describe('beta acceptance', () => {
  it('runs a campaign from creation to the second session, print and export', async () => {
    const user = userEvent.setup()
    const catalog = createLocalCampaignCatalog(new MemoryStorageGateway())
    const { router } = renderApp('/', catalog)

    // 1. New campaign and first session.
    await user.click(await screen.findByRole('button', { name: 'Создать кампанию' }))
    await user.type(screen.getByLabelText('Название'), 'Соляные копи')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Создать' }))
    await user.click(await screen.findByRole('link', { name: /Соляные копи/ }))
    await user.type(await screen.findByLabelText('Название первой сессии'), 'Спуск{Enter}')
    const id = router.state.location.pathname.split('/')[3]
    const nav = () => screen.getByRole('navigation', { name: 'Разделы кампании' })

    // 2. Arc, clock and secret.
    await user.click(within(await screen.findByRole('navigation', { name: 'Разделы кампании' })).getByRole('link', { name: /Сюжет/ }))
    await user.click(await screen.findByRole('button', { name: 'Новая линия' }))
    await user.type(screen.getByLabelText('Название'), 'Обвал')
    await user.selectOptions(screen.getByLabelText('Состояние'), 'active')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    await user.click(within(nav()).getByRole('link', { name: /Пульт/ }))
    await user.click(await screen.findByRole('button', { name: 'Новые часы' }))
    await user.type(screen.getByLabelText('Название'), 'Крепь трещит')
    await user.selectOptions(screen.getByLabelText('Сегментов'), '4')
    await user.type(screen.getByLabelText('Событие при заполнении'), 'Штольня обрушилась')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    await user.click(screen.getByRole('button', { name: /Секреты/ }))
    await user.click(screen.getByRole('button', { name: 'Новый секрет' }))
    await user.type(screen.getByLabelText('Название'), 'Старая карта')
    await user.type(screen.getByLabelText('Мастерская истина'), 'Карта подделана')
    await user.type(screen.getByLabelText('Публичная формулировка'), 'На карте есть странные метки')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    // 3. Plan the session.
    await user.click(within(nav()).getByRole('link', { name: /Сессии/ }))
    await user.click(await screen.findByRole('button', { name: 'Добавить в план' }))
    await user.selectOptions(screen.getByLabelText('Тип пункта плана'), 'event')
    await user.selectOptions(screen.getByLabelText('Приоритет пункта'), 'required')
    await user.type(screen.getByLabelText('Свободный текст пункта плана'), 'Спуск в штольню{Enter}')
    await user.type(screen.getByLabelText('Свободный текст пункта плана'), 'Встреча с рудокопами{Enter}')
    await user.click(screen.getByRole('button', { name: 'Из библиотеки' }))
    await user.click(screen.getByRole('checkbox', { name: /Старая карта/ }))
    await user.click(screen.getByRole('button', { name: 'Добавить (1)' }))

    // 4. Play: log, clock, reveal, close.
    await user.click(screen.getByRole('button', { name: 'Начать' }))
    const panel = await screen.findByLabelText('Живая панель')
    await user.type(within(panel).getByLabelText('Запись живого журнала'), 'Герои спустились{Enter}')
    await user.selectOptions(screen.getByLabelText('Статус Спуск в штольню'), 'used')
    await user.click(within(panel).getByRole('button', { name: /Часы/ }))
    await user.type(within(panel).getByLabelText('Причина: Крепь трещит'), 'Взрыв')
    await user.click(within(panel).getByRole('button', { name: 'Продвинуть Крепь трещит' }))
    await user.click(within(panel).getByRole('button', { name: /Секреты/ }))
    await user.selectOptions(within(panel).getByLabelText('Состояние секрета: Старая карта'), 'everyone')
    await user.click(within(panel).getByRole('button', { name: 'Закрыть сессию' }))
    await user.click(await screen.findByRole('button', { name: 'Закрыть и разобрать' }))

    // 5. Review and carry the unplayed item.
    const wizard = await screen.findByLabelText('Разбор сессии')
    await user.type(within(wizard).getByLabelText('Итоги сессии'), 'Копи ожили')
    await user.click(within(wizard).getByRole('button', { name: 'Далее' }))
    await user.selectOptions(within(wizard).getByLabelText('Решение: Встреча с рудокопами'), 'carry')
    for (let step = 0; step < 3; step += 1) await user.click(within(wizard).getByRole('button', { name: 'Далее' }))
    await user.click(within(wizard).getByRole('button', { name: 'Завершить разбор' }))

    // 6. Second session carries the item.
    await user.click(await screen.findByRole('button', { name: /Открыть сессию №2/ }))
    expect(await screen.findByRole('article', { name: 'Пункт плана: Встреча с рудокопами' })).toBeInTheDocument()

    // 7. Print: the player sheet shows the revealed secret's public version only.
    await user.click(within(nav()).getByRole('link', { name: /Печать/ }))
    await user.selectOptions(await screen.findByLabelText('Сессия'), screen.getByRole('option', { name: /№1 Спуск/ }))
    await user.click(screen.getByRole('button', { name: 'Материалы игроков' }))
    const players = screen.getByRole('article', { name: 'Материалы игроков' })
    expect(within(players).getByText('На карте есть странные метки')).toBeInTheDocument()
    expect(within(players).queryByText('Карта подделана')).not.toBeInTheDocument()

    // 8. Export and import into a fresh browser.
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords).toHaveLength(2))
    const saved = (await catalog.find(id))!
    expect(saved.clocks[0]).toMatchObject({ value: 1, history: [expect.objectContaining({ reason: 'Взрыв' })] })
    expect(saved.secrets[0]).toMatchObject({ status: 'everyone', reveals: [expect.objectContaining({ sessionId: saved.sessionRecords[0].id })] })
    expect(saved.sessionRecords[0]).toMatchObject({ status: 'completed', reviewStatus: 'completed', reviewNotes: 'Копи ожили' })
    expect(saved.sessionRecords[0].planItems.find((item) => item.secretId)?.status).toBe('used')
    const other = createLocalCampaignCatalog(new MemoryStorageGateway())
    const imported = await other.importCampaign(await catalog.exportCampaign(id))
    expect(imported).toMatchObject({ name: 'Соляные копи', storyArcs: [expect.objectContaining({ title: 'Обвал' })] })
    expect(imported.sessionRecords[1].planItems[0]).toMatchObject({ text: 'Встреча с рудокопами', origin: 'review' })
  }, 30000)
})
