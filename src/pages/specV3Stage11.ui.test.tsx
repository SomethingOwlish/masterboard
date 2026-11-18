// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { blankSession } from '../local/normalize'
import type { LocalSessionPlanItem } from '../local/types'
import { readyCampaign, renderApp } from '../test/renderApp'

const NOW = '2026-11-18T08:00:00.000Z'
const item = (id: string, text: string, patch: Partial<LocalSessionPlanItem> = {}): LocalSessionPlanItem => ({
  id, source: 'text', text, kind: 'scene', priority: 'required', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared', ...patch,
})
const activeSession = () => ({
  ...blankSession(1, 'Сова', NOW, 's1'),
  title: 'Первая ночь',
  status: 'active' as const,
  planItems: [item('gate', 'Ворота'), item('guard', 'Стражник', { kind: 'npc', sceneId: 'gate' })],
})

const STYLES = join(__dirname, '..')
const css = [join(STYLES, 'index.css'), ...readdirSync(join(STYLES, 'styles')).map((name) => join(STYLES, 'styles', name))]
  .map((file) => readFileSync(file, 'utf8')).join('\n')

describe('ТЗ-3, этап 11: проведение в две колонки', () => {
  it('shows the plan and the live panel side by side, without the session list', async () => {
    const { catalog, id } = await readyCampaign({ sessionRecords: [activeSession()], activeSessionId: 's1' })
    renderApp(`/local/campaign/${id}/play`, catalog)
    const panel = await screen.findByRole('complementary', { name: 'Живая панель' })
    const layout = document.querySelector('.session-live-layout')!
    expect(layout.querySelector('.session-live-layout__live')).toContainElement(panel)
    expect(within(layout.querySelector<HTMLElement>('.session-live-layout__plan')!).getByLabelText('Сцена: Ворота')).toBeInTheDocument()
    expect(document.querySelector('.sessions-workspace')).toHaveClass('sessions-workspace--live')
    // The plan page keeps the old layout: list of sessions, panel under the plan.
    expect(screen.queryByRole('button', { name: 'Панель проведения' })).not.toBeInTheDocument()
  })

  it('keeps only the status and the title in a plan row, the rest goes into «…»', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ sessionRecords: [activeSession()], activeSessionId: 's1' })
    renderApp(`/local/campaign/${id}/play`, catalog)
    const row = await screen.findByRole('article', { name: 'Пункт плана: Стражник' })
    expect(within(row).getByLabelText('Статус Стражник')).toBeInTheDocument()
    expect(within(row).queryByLabelText('Приоритет Стражник')).not.toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Выше: Стражник' })).not.toBeInTheDocument()

    await user.click(within(row).getByRole('button', { name: 'Действия: Стражник' }))
    const menu = within(row).getByRole('group', { name: 'Действия: Стражник' })
    await user.selectOptions(within(menu).getByLabelText('Приоритет Стражник'), 'useful')
    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].planItems[1].priority).toBe('useful'))
    expect(within(menu).getByRole('button', { name: 'Убрать Стражник из сессии' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(within(row).queryByRole('group', { name: 'Действия: Стражник' })).not.toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Действия: Стражник' })).toHaveFocus()
  })

  it('keeps the full controls in the plan outside of play', async () => {
    const { catalog, id } = await readyCampaign({ sessionRecords: [activeSession()], activeSessionId: 's1' })
    renderApp(`/local/campaign/${id}/session`, catalog)
    const row = await screen.findByRole('article', { name: 'Пункт плана: Стражник' })
    expect(within(row).getByLabelText('Приоритет Стражник')).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Действия: Стражник' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Панель проведения' })).toBeInTheDocument()
  })

  it('switches between the plan and the live panel by tabs', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ sessionRecords: [activeSession()], activeSessionId: 's1' })
    renderApp(`/local/campaign/${id}/play`, catalog)
    const tabs = await screen.findByRole('tablist', { name: 'План или проведение' })
    const layout = document.querySelector('.session-live-layout')!
    expect(layout).toHaveAttribute('data-tab', 'live')
    expect(within(tabs).getByRole('tab', { name: 'Проведение' })).toHaveAttribute('aria-selected', 'true')
    await user.click(within(tabs).getByRole('tab', { name: 'План' }))
    expect(layout).toHaveAttribute('data-tab', 'plan')
  })

  it('makes the layout two columns with a sticky panel, and tabs below 900px', () => {
    expect(css).toMatch(/\.session-live-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(340px, 440px\)/)
    expect(css).toMatch(/\.session-live-layout__live\s*\{[^}]*position:\s*sticky/)
    expect(css).toMatch(/\.session-live-layout \.session-live-panel\s*\{[^}]*overflow-y:\s*auto/)
    expect(css).toMatch(/\.session-live-layout__tabs\s*\{\s*display:\s*none/)
    const narrow = css.slice(css.indexOf('.session-live-layout__tabs {\n  display: none'))
    expect(narrow).toMatch(/@media \(max-width: 900px\)\s*\{\s*\.session-live-layout\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/)
    expect(narrow).toMatch(/\[data-tab="live"\] \.session-live-layout__plan/)
  })

  it('stacks the journal vertically and wraps its buttons instead of scrolling sideways', () => {
    expect(css).toMatch(/\.session-live-panel ol\.session-live-panel__log\s*\{[^}]*display:\s*grid[^}]*overflow-x:\s*hidden/)
    expect(css).toMatch(/\.session-live-panel__log li \.row\s*\{[^}]*flex-wrap:\s*wrap/)
  })
})
