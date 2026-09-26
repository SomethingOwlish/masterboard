import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '../App'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { createLocalCampaignCatalog, type LocalCampaignCatalog } from '../local/catalog'
import { blankSession, withLocalSessions } from '../local/normalize'
import type { LocalCampaignRecord } from '../local/types'
import { LocalCatalogProvider } from '../local/useLocalCampaign'

export function renderApp(path: string, catalog: LocalCampaignCatalog = createLocalCampaignCatalog(new MemoryStorageGateway())) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<LocalCatalogProvider catalog={catalog}><RouterProvider router={router} /></LocalCatalogProvider>)
  return { router, catalog }
}

/** A campaign that already has session 1, so the dashboard opens. */
export async function readyCampaign(patch: Partial<LocalCampaignRecord> = {}) {
  const catalog = createLocalCampaignCatalog(new MemoryStorageGateway())
  const campaign = await catalog.create('Город под стеклом', 'Идея')
  await catalog.update({ ...withLocalSessions(campaign, [{ ...blankSession(1, 'Сова', campaign.createdAt), title: 'Первая ночь' }]), ...patch })
  return { catalog, id: campaign.id }
}
