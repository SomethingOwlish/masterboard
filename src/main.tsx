import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './App'
import { applyStoredTheme } from './theme'
import { repo } from './storage/repository'
import { useConfig } from './store/config'
import './index.css'

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
  </React.StrictMode>,
)
