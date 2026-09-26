import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './App'
import { applyStoredTheme } from './theme'
import { ConfirmHost } from './components/useConfirm'
import { ToastHost } from './components/useToast'
import './ds/styles.css' // design-system tokens, fonts, themes — must load first
import './index.css' // app classes (bridged onto the DS tokens above)

applyStoredTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
    <ConfirmHost />
    <ToastHost />
  </React.StrictMode>,
)
