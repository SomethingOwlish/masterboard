import * as React from 'react'

export interface ThemeChange {
  family: string
  mode: 'light' | 'dark'
  theme: string
}

export interface ThemeSwitcherProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled family: parchment | sage | sumi | indigo | dusk. */
  family?: string
  /** Controlled mode. */
  mode?: 'light' | 'dark'
  onChange?: (change: ThemeChange) => void
  /** Element to write data-theme on. Defaults to document.documentElement. */
  target?: HTMLElement
}

export function ThemeSwitcher(props: ThemeSwitcherProps): React.ReactElement
export const MB_THEMES: { id: string; label: string; swatch: string }[]
