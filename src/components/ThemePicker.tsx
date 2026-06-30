import { useState } from 'react'
import { ThemeSwitcher } from '../ds'
import { getStoredTheme, setTheme, type Family, type Mode } from '../theme'

// Thin persistence wrapper around the design system's ThemeSwitcher: five accent
// dots + a sun/moon toggle. Seeds from the stored shell theme and writes the
// choice back to localStorage (ThemeSwitcher itself sets data-theme on <html>).
export function ThemePicker() {
  const initial = getStoredTheme()
  const [family, setFamily] = useState<Family>(initial.family)
  const [mode, setMode] = useState<Mode>(initial.mode)
  return (
    <ThemeSwitcher
      family={family}
      mode={mode}
      onChange={({ family: f, mode: m }) => {
        const fam = f as Family
        const md = m as Mode
        setFamily(fam)
        setMode(md)
        setTheme(fam, md)
      }}
    />
  )
}
