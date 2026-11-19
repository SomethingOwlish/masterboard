// @vitest-environment jsdom
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { blankSession } from '../local/normalize'
import { readyCampaign, renderApp } from '../test/renderApp'

const SRC = join(__dirname, '..')
const css = [join(SRC, 'index.css'), ...readdirSync(join(SRC, 'styles')).map((name) => join(SRC, 'styles', name))]
  .map((file) => readFileSync(file, 'utf8')).join('\n')

describe('ТЗ-3, этап 16: переход на DS', () => {
  it('switches the Control panel by DS tabs with arrows, Home and End', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/control`, catalog)
    const tabs = await screen.findByRole('tablist', { name: 'Разделы пульта' })
    const clocks = within(tabs).getByRole('tab', { name: /Часы/ })
    expect(clocks).toHaveAttribute('aria-selected', 'true')
    expect(clocks).toHaveAttribute('tabindex', '0')
    expect(within(tabs).getByRole('tab', { name: /Секреты/ })).toHaveAttribute('tabindex', '-1')

    clocks.focus()
    await user.keyboard('{ArrowRight}')
    const secrets = within(tabs).getByRole('tab', { name: /Секреты/ })
    expect(secrets).toHaveAttribute('aria-selected', 'true')
    expect(secrets).toHaveFocus()
    await user.keyboard('{End}')
    expect(within(tabs).getByRole('tab', { name: /Входящие/ })).toHaveFocus()
    expect(screen.getByLabelText('Быстрая запись')).toBeInTheDocument()
    await user.keyboard('{ArrowRight}')
    expect(within(tabs).getByRole('tab', { name: /Часы/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('uses DS tabs for the live panel, the plan views and the library view', async () => {
    const user = userEvent.setup()
    const active = { ...blankSession(1, 'Сова', '2026-11-19T10:00:00.000Z', 's1'), title: 'Игра', status: 'active' as const }
    const { catalog, id } = await readyCampaign({ sessionRecords: [active], activeSessionId: 's1' })
    renderApp(`/local/campaign/${id}/play`, catalog)
    expect(await screen.findByRole('tablist', { name: 'Разделы живой панели' })).toBeInTheDocument()
    const views = screen.getByRole('tablist', { name: 'Вид плана' })
    await user.click(within(views).getByRole('tab', { name: 'По приоритету' }))
    expect(within(views).getByRole('tab', { name: 'По приоритету' })).toHaveAttribute('aria-selected', 'true')

    renderApp(`/local/campaign/${id}/library`, catalog)
    expect(await screen.findByRole('tablist', { name: 'Вид' })).toBeInTheDocument()
  })

  it('removes the DS components the app does not use', () => {
    for (const name of ['surfaces/GlassPanel', 'domain/EntityCard', 'domain/StatBlock', 'domain/RelationNode', 'domain/ChronoEvent', 'domain/RecapItem', 'domain/SyncBadge', 'navigation/SidebarNav', 'navigation/Topbar']) {
      expect(existsSync(join(SRC, 'ds/components', `${name}.jsx`))).toBe(false)
    }
  })

  it('has no !important on form controls and checkboxes', () => {
    expect(css).not.toMatch(/\.local-checkbox[^{]*\{[^}]*!important/)
    expect(css).not.toMatch(/\.local-checklist label\s*\{[^}]*!important/)
    expect(css).not.toMatch(/\.session-passport-form__arcs label\s*\{[^}]*!important/)
  })
})
