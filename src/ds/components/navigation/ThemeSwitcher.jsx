import React from 'react'
import { Icon } from '../core/Icon'

export const MB_THEMES = [
  { id: 'parchment', label: 'Parchment', swatch: '#9c5436' },
  { id: 'sage', label: 'Sage', swatch: '#4f6f52' },
  { id: 'sumi', label: 'Sumi', swatch: '#c2412d' },
  { id: 'indigo', label: 'Indigo', swatch: '#2e4a7a' },
  { id: 'dusk', label: 'Dusk', swatch: '#1f7a72' },
]

/**
 * ThemeSwitcher — picks one of five colour families and toggles light/dark,
 * writing data-theme on <html> (e.g. "sumi-dark"). Renders five accent dots and
 * a sun/moon toggle. Controlled (pass family/mode/onChange) or self-managing.
 */
export function ThemeSwitcher({ family, mode, onChange, target, style, ...rest }) {
  const [fam, setFam] = React.useState(family || 'parchment')
  const [md, setMd] = React.useState(mode || 'light')
  const curFam = family ?? fam
  const curMode = mode ?? md

  const apply = (f, m) => {
    const el = target || (typeof document !== 'undefined' ? document.documentElement : null)
    if (el) el.dataset.theme = m === 'dark' ? `${f}-dark` : f
    if (onChange) onChange({ family: f, mode: m, theme: m === 'dark' ? `${f}-dark` : f })
  }
  const pickFamily = (f) => { setFam(f); apply(f, curMode) }
  const toggleMode = () => { const m = curMode === 'dark' ? 'light' : 'dark'; setMd(m); apply(curFam, m) }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: '5px 8px 5px 10px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-pill)',
        boxShadow: 'var(--shadow-sm)',
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: 'inline-flex', gap: 6 }}>
        {MB_THEMES.map((t) => {
          const active = t.id === curFam
          return (
            <button
              key={t.id}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={active}
              onClick={() => pickFamily(t.id)}
              style={{
                width: 18,
                height: 18,
                padding: 0,
                borderRadius: '50%',
                background: t.swatch,
                border: 'none',
                cursor: 'pointer',
                outline: active ? '2px solid var(--text)' : '1px solid var(--border)',
                outlineOffset: active ? 1 : 0,
                transition: 'transform var(--dur-fast) var(--ease-out)',
                transform: active ? 'scale(1.05)' : 'scale(1)',
              }}
            />
          )
        })}
      </div>
      <span style={{ width: 1, height: 18, background: 'var(--border)' }} />
      <button
        type="button"
        onClick={toggleMode}
        aria-label={curMode === 'dark' ? 'Switch to light' : 'Switch to dark'}
        title={curMode === 'dark' ? 'Light' : 'Dark'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 22,
          padding: 0,
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          background: 'transparent',
          color: 'var(--text)',
          cursor: 'pointer',
        }}
      >
        <Icon name={curMode === 'dark' ? 'moon' : 'sun'} size={16} />
      </button>
    </div>
  )
}
