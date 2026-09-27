import { render, screen, within } from '@testing-library/react'
import { CAMPAIGN_SECTIONS, NAV_GROUPS } from '../components/local/shared'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '../App'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { createLocalCampaignCatalog, type LocalCampaignCatalog } from '../local/catalog'
import { blankSession, withLocalSessions } from '../local/normalize'
import type { LocalCampaignRecord } from '../local/types'
import { LocalCatalogProvider } from '../local/useLocalCampaign'
import { ConfirmHost } from '../components/useConfirm'
import { ExternalProvider, type ExternalPort } from '../local/useExternal'
import { FakeBridge } from './fakeBridge'
import { MemoryPlayersGateway, type PlayersGateway } from '../local/players'
import { PlayersContext } from '../local/playersContext'

/** Renders the app on `path`; lorebook / lovegame are an in-memory bridge unless a test passes its own. */
export function renderApp(path: string, catalog: LocalCampaignCatalog = createLocalCampaignCatalog(new MemoryStorageGateway()), bridge: ExternalPort = new FakeBridge(), players: PlayersGateway = new MemoryPlayersGateway()) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<LocalCatalogProvider catalog={catalog}><ExternalProvider port={bridge}><PlayersContext.Provider value={players}><RouterProvider router={router} /><ConfirmHost /></PlayersContext.Provider></ExternalProvider></LocalCatalogProvider>)
  return { router, catalog, bridge, players }
}

/** A campaign that already has session 1, so the dashboard opens. */
export async function readyCampaign(patch: Partial<LocalCampaignRecord> = {}) {
  const catalog = createLocalCampaignCatalog(new MemoryStorageGateway())
  const campaign = await catalog.create('Город под стеклом', 'Идея')
  await catalog.update({ ...withLocalSessions(campaign, [{ ...blankSession(1, 'Сова', campaign.createdAt), title: 'Первая ночь' }]), ...patch })
  return { catalog, id: campaign.id }
}

/** Opens a campaign section through the grouped menu (ТЗ-2, R4): group first, then the section. */
export async function goToSection(user: { click: (element: Element) => Promise<void> }, label: string) {
  const nav = await screen.findByRole('navigation', { name: 'Разделы кампании' })
  const direct = within(nav).queryByRole('link', { name: new RegExp(label) })
  if (direct) return user.click(direct)
  const group = NAV_GROUPS.find((item) => item.sections.some((id) => CAMPAIGN_SECTIONS.find((section) => section.id === id)?.label === label))
  if (!group) throw new Error(`Нет раздела «${label}» в меню`)
  await user.click(within(nav).getByRole('button', { name: new RegExp(group.label) }))
  await user.click(within(nav).getByRole('menuitem', { name: new RegExp(label) }))
}
