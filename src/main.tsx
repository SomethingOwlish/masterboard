import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './App'
import { applyStoredTheme } from './theme'
import { repo } from './storage/repository'
import { useConfig } from './store/config'
import { ConfirmHost } from './components/useConfirm'
import { ToastHost } from './components/useToast'
import './ds/styles.css' // design-system tokens, fonts, themes — must load first
import './index.css' // app classes (bridged onto the DS tokens above)

applyStoredTheme()

// Load the encrypted PAT (if any) so the first reads can hit GitHub when configured.
void useConfig.getState().hydrate()

// Flush any debounced GitHub pushes before the tab goes away.
window.addEventListener('beforeunload', () => {
  void repo.flush()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
    <ConfirmHost />
    <ToastHost />
  </React.StrictMode>,
)
