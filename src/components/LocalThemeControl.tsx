import { useState } from 'react'
import { Icon, ThemeSwitcher } from '../ds'
import { THEME_LABELS } from '../local/labels'
import { getStoredTheme, setTheme, type Family, type Mode } from '../theme'

/** The switcher is always visible on wide screens; on a phone it sits behind a button (see `.theme-control` in campaign.css). */
export function LocalThemeControl() {
  const [theme, setCurrent] = useState(getStoredTheme)
  const [open, setOpen] = useState(false)
  return (
    <div className={`theme-control${open ? ' theme-control--open' : ''}`}>
      <button
        type="button"
        className="theme-control__toggle"
        aria-label="Выбрать оформление"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="palette" size={18} />
      </button>
      <div className="theme-control__panel">
        <ThemeSwitcher
          aria-label="Оформление интерфейса"
          family={theme.family}
          mode={theme.mode}
          labels={THEME_LABELS}
          onChange={({ family, mode }) => { const next = { family: family as Family, mode: mode as Mode }; setTheme(next.family, next.mode); setCurrent(next) }}
        />
      </div>
    </div>
  )
}
