import { useState } from 'react'
import { ThemeSwitcher } from '../ds'
import { getStoredTheme, setTheme, type Family, type Mode } from '../theme'

export function LocalThemeControl() {
  const [theme, setCurrent] = useState(getStoredTheme)
  return <ThemeSwitcher aria-label="Оформление интерфейса" family={theme.family} mode={theme.mode} onChange={({ family, mode }) => { const next = { family: family as Family, mode: mode as Mode }; setTheme(next.family, next.mode); setCurrent(next) }} />
}
