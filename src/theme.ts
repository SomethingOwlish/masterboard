// Theme presets are pure CSS-variable swaps driven by `data-theme` on <html>.
// Stored in localStorage for the shell; a campaign can override via its settings.

export type ThemeId = 'parchment' | 'dark' | 'contrast' | 'neon'

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'parchment', label: 'Parchment' },
  { id: 'dark', label: 'Dark' },
  { id: 'contrast', label: 'High contrast' },
  { id: 'neon', label: 'Neon' },
]

const KEY = 'mb.theme'

export function applyStoredTheme(): void {
  const stored = (localStorage.getItem(KEY) as ThemeId | null) ?? 'parchment'
  setTheme(stored)
}

export function setTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id
  localStorage.setItem(KEY, id)
}

export function getTheme(): ThemeId {
  return (document.documentElement.dataset.theme as ThemeId) ?? 'parchment'
}
