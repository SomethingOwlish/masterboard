import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Hub } from './pages/Hub'
import { CampaignLayout } from './pages/CampaignLayout'
import { ModulePlaceholder } from './pages/ModulePlaceholder'
import { MODULES } from './modules'

// Vite injects BASE_URL ('/masterboard/' in prod). React Router needs it without
// the trailing slash as its basename.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export const router = createBrowserRouter(
  [
    { path: '/', element: <Hub /> },
    {
      path: '/campaign/:campaignId',
      element: <CampaignLayout />,
      children: MODULES.map((m) => ({
        index: m.path === '',
        path: m.path === '' ? undefined : m.path,
        element: <ModulePlaceholder moduleId={m.id} />,
      })),
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ],
  { basename },
)
