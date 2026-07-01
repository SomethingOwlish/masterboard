// The app themes come in light/dark pairs — `family` (light) and `family-dark`
// (dark), set as `data-theme` on <html>. React Flow's `colorMode` needs the plain
// light/dark, so this maps the active theme to one and re-renders when the GM
// toggles the theme (the attribute changes without any React state moving).

import { useSyncExternalStore } from 'react'

export type ColorScheme = 'light' | 'dark'

function getScheme(): ColorScheme {
  const theme = document.documentElement.getAttribute('data-theme')
  return theme?.endsWith('-dark') ? 'dark' : 'light'
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}

/** Active React Flow color mode, derived from the app theme and kept in sync. */
export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(subscribe, getScheme, () => 'light')
}
