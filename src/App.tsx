import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { LocalCampaignsPage } from './pages/LocalCampaignsPage'
import { LocalNewCampaignPage } from './pages/LocalNewCampaignPage'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export const routes: RouteObject[] = [
  { path: '/', element: <LocalCampaignsPage /> },
  { path: '/local/campaign/:campaignId/:section?', element: <LocalNewCampaignPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes, { basename })
