// WCAG contrast helpers for the theme token tests. Colours are read from themes.css as plain hex.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Theme = Record<string, string>

const CSS = readFileSync(join(__dirname, '..', 'ds', 'tokens', 'themes.css'), 'utf8')

/** Every theme scope in themes.css → its `--token: #hex` declarations. */
export const loadThemes = (): Record<string, Theme> => {
  const themes: Record<string, Theme> = {}
  for (const match of CSS.matchAll(/((?::root,\s*)?\[data-theme='([\w-]+)'\])\s*\{([^}]*)\}/g)) {
    const tokens: Theme = {}
    for (const decl of match[3].matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\b/g)) tokens[decl[1]] = decl[2]
    themes[match[2]] = tokens
  }
  return themes
}

export const parseHex = (hex: string): [number, number, number] => {
  const h = hex.slice(1)
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6)
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}

const luminance = (hex: string): number => {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
