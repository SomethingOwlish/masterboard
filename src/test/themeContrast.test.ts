// Stage 8 guard: WCAG AA for the token pairs the UI actually uses, in every theme.
// Text pairs need 4.5:1, borders of controls 3:1.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrast, loadThemes } from './contrast'

const themes = loadThemes()

/** [foreground token, background token, minimum ratio] */
const PAIRS: Array<[string, string, number]> = [
  ['--muted', '--bg', 4.5],
  ['--muted', '--surface', 4.5],
  ['--muted', '--surface-2', 4.5],
  ['--text', '--surface', 4.5],
  ['--warning-text', '--surface', 4.5],
  ['--warning-text', '--surface-2', 4.5],
  ['--border-strong', '--surface', 3],
  ['--border-strong', '--bg', 3],
]

describe('theme contrast', () => {
  it('finds all ten themes', () => {
    expect(Object.keys(themes).sort()).toEqual([
      'dusk', 'dusk-dark', 'indigo', 'indigo-dark', 'parchment', 'parchment-dark',
      'sage', 'sage-dark', 'sumi', 'sumi-dark',
    ])
  })

  for (const [name, tokens] of Object.entries(themes)) {
    for (const [fg, bg, min] of PAIRS) {
      it(`${name}: ${fg} on ${bg} ≥ ${min}`, () => {
        expect(tokens[fg], `${fg} missing`).toBeTruthy()
        expect(tokens[bg], `${bg} missing`).toBeTruthy()
        expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min)
      })
    }
  }
})

describe('stage 8 stylesheet rules', () => {
  const read = (...parts: string[]) => readFileSync(join(__dirname, '..', ...parts), 'utf8')

  it('index.css has no !important on colours and no body --muted patch', () => {
    const css = read('index.css')
    expect(css).not.toMatch(/(color|background|border[\w-]*)\s*:[^;]*!important/)
    expect(css).not.toMatch(/body\s*\{[^}]*--muted/)
  })

  it('fonts are self-hosted', () => {
    const css = read('ds', 'tokens', 'fonts.css')
    expect(css).not.toMatch(/@import|https?:\/\//)
    expect(read('ds', 'tokens', 'typography.css')).not.toContain('Space Mono')
  })
})
