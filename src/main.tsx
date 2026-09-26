import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './App'
import { applyStoredTheme } from './theme'
import { ConfirmHost } from './components/useConfirm'
import { ToastHost } from './components/useToast'
import { resolveCatalog } from './local/remote'
import { LocalCatalogProvider, browserCatalog } from './local/useLocalCampaign'
import './ds/styles.css' // design-system tokens, fonts, themes — must load first
import './index.css' // app classes (bridged onto the DS tokens above)

applyStoredTheme()

// Signed in through Cloudflare Access → shared campaigns on the Worker; otherwise browser-only.
void resolveCatalog(browserCatalog()).then((catalog) => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <LocalCatalogProvider catalog={catalog}>
        <RouterProvider router={router} />
        <ConfirmHost />
        <ToastHost />
      </LocalCatalogProvider>
    </React.StrictMode>,
  )
})
