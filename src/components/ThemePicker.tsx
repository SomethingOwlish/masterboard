import { useState } from 'react'
import { THEMES, getTheme, setTheme, type ThemeId } from '../theme'

export function ThemePicker() {
  const [theme, setLocal] = useState<ThemeId>(getTheme())
  return (
    <label className="row" style={{ gap: '0.4rem' }}>
      <span className="muted">Theme</span>
      <select
        value={theme}
        onChange={(e) => {
          const id = e.target.value as ThemeId
          setTheme(id)
          setLocal(id)
        }}
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
    </label>
  )
}
