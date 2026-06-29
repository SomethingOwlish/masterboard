import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Hub } from './pages/Hub'
import { CampaignLayout } from './pages/CampaignLayout'
import { CampaignOverview } from './pages/CampaignOverview'
import { ActivityLog } from './pages/ActivityLog'
import { SettingsPage } from './pages/SettingsPage'
import { ModulePlaceholder } from './pages/ModulePlaceholder'
import { MODULES } from './modules'
import type { ReactElement } from 'react'

// Vite injects BASE_URL ('/masterboard/' in prod). React Router needs it without
// the trailing slash as its basename.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

// Modules that have a real implementation get their own element; everything else
// renders the placeholder until its batch lands.
const MODULE_ELEMENTS: Record<string, ReactElement> = {
  overview: <CampaignOverview />,
  activity: <ActivityLog />,
  settings: <SettingsPage />,
}

export const router = createBrowserRouter(
  [
    { path: '/', element: <Hub /> },
    { path: '/settings', element: <SettingsPage /> },
    {
      path: '/campaign/:campaignId',
      element: <CampaignLayout />,
      children: MODULES.map((m) => ({
        index: m.path === '',
        path: m.path === '' ? undefined : m.path,
        element: MODULE_ELEMENTS[m.id] ?? <ModulePlaceholder moduleId={m.id} />,
      })),
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ],
  { basename },
)
