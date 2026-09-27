// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newEntity } from '../local/domain'
import { readyCampaign, renderApp } from '../test/renderApp'

const olan = () => newEntity({ id: 'olan', type: 'npc', name: 'Олан' })

describe('ТЗ-3, этап 4: один примитив диалога', () => {
  it('keeps Tab inside the entity editor, closes on Escape from body and returns focus', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities: [olan()] })
    renderApp(`/local/campaign/${id}/library`, catalog)
    const edit = await screen.findByRole('button', { name: 'Редактировать: Олан' })
    await user.click(edit)
    const dialog = screen.getByRole('dialog', { name: 'Редактировать сущность' })
    // Focus starts on the first field — the type select comes before the name.
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toBeInTheDocument()
    expect(screen.queryByText('Локальные параметры')).not.toBeInTheDocument()
    for (let step = 0; step < 40; step += 1) {
      await user.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
    for (let step = 0; step < 5; step += 1) {
      await user.tab({ shift: true })
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
    const focused = document.activeElement as HTMLElement
    focused.blur()
    expect(document.activeElement).toBe(document.body)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(edit).toHaveFocus()
  })

  it('asks before dropping passport edits on a backdrop click, Escape or «×»', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Паспорт' }))
    const passport = screen.getByRole('dialog', { name: 'Паспорт сессии' })
    const title = within(passport).getByLabelText('Название')
    expect(title).toHaveFocus()
    await user.type(title, ' у маяка')

    fireEvent.mouseDown(passport.parentElement!)
    const ask = screen.getByRole('dialog', { name: 'Закрыть без сохранения?' })
    // The question is the top dialog: Escape closes it, not the passport.
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Закрыть без сохранения?' })).not.toBeInTheDocument()
    expect(passport).toBeInTheDocument()
    expect(ask).not.toBeInTheDocument()

    await user.click(within(passport).getByRole('button', { name: 'Закрыть' }))
    await user.click(screen.getByRole('button', { name: 'Продолжить правку' }))
    expect(within(passport).getByLabelText('Название')).toHaveValue('Первая ночь у маяка')

    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Закрыть без сохранения' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect((await catalog.find(id))!.sessionRecords[0].title).toBe('Первая ночь')
    expect(screen.getByRole('button', { name: 'Паспорт' })).toHaveFocus()
  })

  it('closes an untouched dialog on the backdrop without asking; «Отмена» never asks', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/session`, catalog)
    await user.click(await screen.findByRole('button', { name: 'Паспорт' }))
    fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Паспорт сессии' }).parentElement!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Паспорт' }))
    await user.type(screen.getByLabelText('Название'), '!')
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks before closing «Новая кампания» with a typed name', async () => {
    const user = userEvent.setup()
    renderApp('/local')
    await user.click(await screen.findByRole('button', { name: /Новая кампания/ }))
    const dialog = screen.getByRole('dialog', { name: 'С чего начинается история?' })
    expect(within(dialog).getByLabelText('Название')).toHaveFocus()
    await user.type(within(dialog).getByLabelText('Название'), 'Маяк')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Закрыть без сохранения?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Закрыть без сохранения' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('focuses the side panel title, closes it on Escape and returns focus to the link', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities: [olan()] })
    renderApp(`/local/campaign/${id}/library`, catalog)
    const link = await screen.findByRole('button', { name: 'Олан' })
    await user.click(link)
    const panel = await screen.findByRole('complementary', { name: /Олан/ })
    expect(within(panel).getByRole('heading', { name: 'Олан', level: 2 })).toHaveFocus()

    // A dialog above the panel takes Escape first.
    await user.click(within(panel).getByRole('button', { name: 'Редактировать' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(panel).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Редактировать' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('complementary', { name: /Олан/ })).not.toBeInTheDocument()
    await waitFor(() => expect(link).toHaveFocus())
  })

  it('announces search results as a combobox with an active option', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ entities: [olan(), newEntity({ id: 'oleg', type: 'npc', name: 'Олег' })] })
    renderApp(`/local/campaign/${id}/library`, catalog)
    const edit = await screen.findByRole('button', { name: 'Редактировать: Олан' })
    edit.focus()
    await user.keyboard('{Control>}k{/Control}')
    const box = screen.getByRole('combobox', { name: 'Что ищем' })
    expect(box).toHaveFocus()
    expect(box).toHaveAttribute('aria-expanded', 'false')
    await user.type(box, 'Ол')
    expect(box).toHaveAttribute('aria-expanded', 'true')
    const list = screen.getByRole('listbox', { name: 'Найдено' })
    expect(box).toHaveAttribute('aria-controls', list.id)
    const options = within(list).getAllByRole('option')
    expect(box).toHaveAttribute('aria-activedescendant', options[0].id)
    await user.keyboard('{ArrowDown}')
    expect(box).toHaveAttribute('aria-activedescendant', options[1].id)
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
    await user.tab()
    expect(box).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('combobox', { name: 'Что ищем' })).not.toBeInTheDocument()
    await waitFor(() => expect(edit).toHaveFocus())
  })
})
