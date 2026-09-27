import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { BackupsPage } from './pages/BackupsPage'
import { ImportPage } from './pages/ImportPage'
import { LocalCampaignsPage } from './pages/LocalCampaignsPage'
import { LocalNewCampaignPage } from './pages/LocalNewCampaignPage'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export const routes: RouteObject[] = [
  { path: '/', element: <LocalCampaignsPage /> },
  { path: '/backups', element: <BackupsPage /> },
  { path: '/import', element: <ImportPage /> },
  { path: '/local/campaign/:campaignId/entity/:entityId', element: <LocalNewCampaignPage /> },
  { path: '/local/campaign/:campaignId/:section?', element: <LocalNewCampaignPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes, { basename })
