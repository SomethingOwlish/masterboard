import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Hub } from './pages/Hub'
import { CampaignLayout } from './pages/CampaignLayout'
import { CampaignOverview } from './pages/CampaignOverview'
import { CharactersPage } from './pages/CharactersPage'
import { NpcsPage } from './pages/NpcsPage'
import { RelationsBoard } from './pages/RelationsBoard'
import { ChronologyPage } from './pages/ChronologyPage'
import { SessionsPage } from './pages/SessionsPage'
import { LocationsPage } from './pages/LocationsPage'
import { MiscPage } from './pages/MiscPage'
import { TasksPage } from './pages/TasksPage'
import { RulesPage } from './pages/RulesPage'
import { PrintPage } from './pages/PrintPage'
import { ActivityLog } from './pages/ActivityLog'
import { LibraryPage } from './pages/LibraryPage'
import { SettingsPage } from './pages/SettingsPage'
import { ModulePlaceholder } from './pages/ModulePlaceholder'
import { LocalSessionDemoPage } from './pages/LocalSessionDemoPage'
import { LocalCampaignDashboardPage } from './pages/LocalCampaignDashboardPage'
import { LocalLibraryPage } from './pages/LocalLibraryPage'
import { LocalPublicationManagerPage } from './pages/LocalPublicationManagerPage'
import { MODULES } from './modules'
import { lazy, Suspense, type ReactElement } from 'react'

// The Session planner pulls in React Flow + the drawing layer. Code-split it so it
// only loads when a session board is actually opened, keeping the initial bundle lean.
const SessionPlanner = lazy(() =>
  import('./pages/SessionPlanner').then((m) => ({ default: m.SessionPlanner })),
)

// Vite injects BASE_URL. Cloudflare serves the application from the domain root;
// keeping this derived still allows a deliberate subpath preview if ever needed.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

// Modules that have a real implementation get their own element; everything else
// renders the placeholder until its batch lands.
const MODULE_ELEMENTS: Record<string, ReactElement> = {
  overview: <CampaignOverview />,
  library: <LibraryPage />,
  characters: <CharactersPage />,
  npcs: <NpcsPage />,
  relations: <RelationsBoard />,
  chronology: <ChronologyPage />,
  sessions: <SessionsPage />,
  locations: <LocationsPage />,
  misc: <MiscPage />,
  tasks: <TasksPage />,
  rules: <RulesPage />,
  print: <PrintPage />,
  activity: <ActivityLog />,
  settings: <SettingsPage />,
}

export const router = createBrowserRouter(
  [
    { path: '/', element: <Hub /> },
    { path: '/settings', element: <SettingsPage /> },
    { path: '/demo/session', element: <LocalSessionDemoPage /> },
    { path: '/demo/campaign', element: <LocalCampaignDashboardPage /> },
    { path: '/demo/library', element: <LocalLibraryPage /> },
    { path: '/demo/publications', element: <LocalPublicationManagerPage /> },
    {
      path: '/campaign/:campaignId',
      element: <CampaignLayout />,
      children: [
        ...MODULES.map((m) => ({
          index: m.path === '',
          path: m.path === '' ? undefined : m.path,
          element: MODULE_ELEMENTS[m.id] ?? <ModulePlaceholder moduleId={m.id} />,
        })),
        // One session document's planner board, nested under the Sessions list.
        {
          path: 'sessions/:sessionId',
          element: (
            <Suspense fallback={<div className="content"><p className="muted">Loading planner…</p></div>}>
              <SessionPlanner />
            </Suspense>
          ),
        },
      ],
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ],
  { basename },
)
