import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LocalCampaignsPage } from './pages/LocalCampaignsPage'
import { LocalSessionDemoPage } from './pages/LocalSessionDemoPage'
import { LocalCampaignDashboardPage } from './pages/LocalCampaignDashboardPage'
import { LocalLibraryPage } from './pages/LocalLibraryPage'
import { LocalPublicationManagerPage } from './pages/LocalPublicationManagerPage'
import { LocalSessionBoardPage } from './pages/LocalSessionBoardPage'
import { LocalConductorPage } from './pages/LocalConductorPage'
import { LocalReviewPage } from './pages/LocalReviewPage'
import { LocalStoryMapPage } from './pages/LocalStoryMapPage'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

// Legacy pages stay in the repository for possible reuse, but are deliberately
// absent from the product router. Every visible route uses the target UI.
export const router = createBrowserRouter([
  { path: '/', element: <LocalCampaignsPage /> },
  { path: '/demo/session', element: <LocalSessionDemoPage /> },
  { path: '/demo/campaign', element: <LocalCampaignDashboardPage /> },
  { path: '/demo/library', element: <LocalLibraryPage /> },
  { path: '/demo/publications', element: <LocalPublicationManagerPage /> },
  { path: '/demo/session-board', element: <LocalSessionBoardPage /> },
  { path: '/demo/conductor', element: <LocalConductorPage /> },
  { path: '/demo/review', element: <LocalReviewPage /> },
  { path: '/demo/story-map', element: <LocalStoryMapPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
], { basename })
