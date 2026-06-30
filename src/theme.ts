// Theme is a CSS-variable swap driven by `data-theme` on <html>, sourced from
// the design system's tokens/themes.css. Five colour families each ship a light
// and a dark mode (data-theme = family, or `${family}-dark`). The shell choice
// is persisted in localStorage; a campaign may override the family via its
// settings. Legacy stored values from the old 4-theme system are migrated.

export type Family = 'parchment' | 'sage' | 'sumi' | 'indigo' | 'dusk'
export type Mode = 'light' | 'dark'

export interface StoredTheme {
  family: Family
  mode: Mode
}

export const FAMILIES: { id: Family; label: string }[] = [
  { id: 'parchment', label: 'Parchment' },
  { id: 'sage', label: 'Sage' },
  { id: 'sumi', label: 'Sumi' },
  { id: 'indigo', label: 'Indigo' },
  { id: 'dusk', label: 'Dusk' },
]

// Back-compat alias: a few callers still import THEMES as the family list.
export const THEMES = FAMILIES

const KEY = 'mb.theme'
const FAMILY_IDS = new Set<string>(FAMILIES.map((f) => f.id))

// Old 4-theme ids → the closest new {family, mode}.
const LEGACY: Record<string, StoredTheme> = {
  parchment: { family: 'parchment', mode: 'light' },
  dark: { family: 'parchment', mode: 'dark' },
  neon: { family: 'dusk', mode: 'dark' },
  contrast: { family: 'sumi', mode: 'light' },
}

export function resolveDataTheme(family: Family, mode: Mode): string {
  return mode === 'dark' ? `${family}-dark` : family
}

function read(): StoredTheme {
  const raw = localStorage.getItem(KEY)
  if (!raw) return { family: 'parchment', mode: 'light' }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredTheme>
    if (parsed && parsed.family && FAMILY_IDS.has(parsed.family)) {
      return { family: parsed.family, mode: parsed.mode === 'dark' ? 'dark' : 'light' }
    }
  } catch {
    /* not JSON — fall through to legacy string handling */
  }
  return LEGACY[raw] ?? { family: 'parchment', mode: 'light' }
}

export function applyStoredTheme(): void {
  const { family, mode } = read()
  document.documentElement.dataset.theme = resolveDataTheme(family, mode)
}

export function getStoredTheme(): StoredTheme {
  return read()
}

export function setTheme(family: Family, mode: Mode): void {
  document.documentElement.dataset.theme = resolveDataTheme(family, mode)
  localStorage.setItem(KEY, JSON.stringify({ family, mode }))
}

// Map any campaign-stored theme value (legacy id, family, or `${family}-dark`)
// to a `data-theme` attribute string. Used when a campaign overrides the shell.
export function campaignThemeToDataAttr(theme: string): string {
  const legacy = LEGACY[theme]
  if (legacy) return resolveDataTheme(legacy.family, legacy.mode)
  return theme
}
