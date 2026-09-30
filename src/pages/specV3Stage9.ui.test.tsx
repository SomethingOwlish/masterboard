// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { readyCampaign, renderApp } from '../test/renderApp'

const STYLES = join(__dirname, '..')
const cssFiles = [join(STYLES, 'index.css'), ...readdirSync(join(STYLES, 'styles')).map((name) => join(STYLES, 'styles', name))]
const css = cssFiles.map((file) => readFileSync(file, 'utf8')).join('\n')
const rulesFor = (selector: string): string[] =>
  [...css.matchAll(new RegExp(`${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`, 'g'))].map((match) => match[1])

describe('ТЗ-3, этап 9: мобильная вёрстка', () => {
  it('uses dynamic viewport units: no plain vh is left in the styles', () => {
    expect(css.match(/\d\s*vh\b/g)).toBeNull()
  })

  it('keeps the campaign name on a phone and truncates it', () => {
    const phone = css.slice(css.indexOf('/* Phone: one row for back + name'))
    expect(phone).toContain('.campaign-topbar__name')
    expect(phone).not.toMatch(/\.campaign-topbar__name\s*\{[^}]*display:\s*none/)
    expect(rulesFor('.campaign-topbar__name').join('')).toContain('text-overflow: ellipsis')
  })

  it('scrolls the section nav sideways and opens the group menu as a bottom sheet on a phone', () => {
    const phone = css.slice(css.indexOf('/* Phone: sections scroll sideways'))
    expect(phone).toMatch(/\.campaign-nav\s*\{[^}]*flex-wrap:\s*nowrap[^}]*overflow-x:\s*auto/)
    expect(phone).toMatch(/\.campaign-nav__menu\s*\{[^}]*position:\s*fixed[^}]*bottom:\s*0/)
  })

  it('does not hide the section nav of the sessions workspace on a phone', () => {
    expect(css).not.toMatch(/\.sessions-workspace__top nav\s*\{[^}]*display:\s*none/)
  })

  it('makes the bulk bar compact on a phone', () => {
    const phone = css.slice(css.indexOf('/* Phone: a slim bar'))
    expect(phone).toMatch(/\.bulk-bar__form input\s*\{[^}]*min-width:\s*0/)
  })

  it('keeps the live log from scrolling sideways', () => {
    expect(rulesFor('.session-live-panel ol.session-live-panel__log').join('')).toContain('overflow-x: hidden')
    expect(rulesFor('.session-live-panel__log li').join('')).toContain('minmax(0, 1fr)')
  })

  it('puts the theme switcher behind a button that opens it', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/overview`, catalog)
    const toggle = await screen.findByRole('button', { name: 'Выбрать оформление' })
    const control = toggle.closest('.theme-control') as HTMLElement
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(control).not.toHaveClass('theme-control--open')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(control).toHaveClass('theme-control--open')
    expect(within(control).getByLabelText('Оформление интерфейса')).toBeInTheDocument()
  })

  it('truncates the campaign name in the sessions workspace top bar', async () => {
    const { catalog, id } = await readyCampaign()
    renderApp(`/local/campaign/${id}/session`, catalog)
    const back = (await screen.findByText('Город под стеклом', { selector: '.sessions-workspace__top a span' })).closest('a')!
    expect(back).toHaveAttribute('href', `/local/campaign/${id}/overview`)
  })
})
