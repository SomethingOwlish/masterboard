import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './App'
import { applyStoredTheme } from './theme'
import { ConfirmHost } from './components/useConfirm'
import { ToastHost } from './components/useToast'
import { resolveCatalog } from './local/remote'
import { LocalCatalogProvider } from './local/useLocalCampaign'
import { createLocalCampaignCatalog } from './local/catalog'
import { IdbStorageGateway } from './adapters/idbStorageGateway'
import { SignInPage } from './pages/SignInPage'
import './ds/styles.css' // design-system tokens, fonts, themes — must load first
import './index.css' // app classes (bridged onto the DS tokens above)
import './styles/home.css'
import './styles/campaign.css'
import './styles/sessions.css'
import './styles/print.css' // last: print overrides everything above

applyStoredTheme()

// Everything is behind sign-in (decision F1). The browser store is only read to
// move campaigns kept here before that; it no longer seeds an example campaign.
const browser = createLocalCampaignCatalog(new IdbStorageGateway(), { legacyStorage: window.localStorage, seed: false })

void resolveCatalog(browser).then((catalog) => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      {catalog
        ? <LocalCatalogProvider catalog={catalog}>
          <RouterProvider router={router} />
          <ConfirmHost />
          <ToastHost />
        </LocalCatalogProvider>
        : <SignInPage />}
    </React.StrictMode>,
  )
})
