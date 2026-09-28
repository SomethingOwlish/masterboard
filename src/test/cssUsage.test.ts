// Stage 7 guard: the app stylesheets hold only live rules — every class they style is used in the
// sources, and every var(--x) they read is defined somewhere.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')

/** Classes built at runtime from a prefix, e.g. `scene-tree__item--${item.priority}`. */
const DYNAMIC_PREFIXES = [
  'plan-graph__node--', // PlanGraph: kind, alt-N group
  'plan-timeline__card--', // PlanViews: item status
  'publish-item--', // PublishSection: publication state
  'scene-tree__item--', // SceneTree: priority
  'scene-tree__scene--',
  'scene-tree__select--',
]
/** Classes that come from outside our sources (libraries, the browser). */
const EXTERNAL_CLASSES: string[] = []

const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? walk(path) : [path]
})
const files = walk(SRC)
const appCss = files.filter((file) => file === join(SRC, 'index.css') || file.startsWith(join(SRC, 'styles') + '/'))
const allCss = files.filter((file) => file.endsWith('.css'))
const sources = files.filter((file) => /\.(tsx?|jsx?)$/.test(file) && !/\.test\.|\.d\.ts$/.test(file))

/** Every whitespace-separated word of every string and template literal in the sources. */
function sourceWords(): Set<string> {
  const words = new Set<string>()
  const add = (text: string) => { for (const word of text.split(/\s+/)) if (word) words.add(word) }
  for (const file of sources) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, false, /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const visit = (node: ts.Node) => {
      if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) add(node.text)
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return words
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Selector text: whatever stands before each `{`. */
function selectorClasses(css: string): Set<string> {
  const classes = new Set<string>()
  for (const match of stripComments(css).matchAll(/([^{};]*)\{/g)) {
    if (match[1].trim().startsWith('@')) continue
    for (const found of match[1].matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) classes.add(found[1])
  }
  return classes
}

describe('app stylesheets', () => {
  it('style only classes the sources use', () => {
    const words = sourceWords()
    const unused = appCss.flatMap((file) => [...selectorClasses(readFileSync(file, 'utf8'))]
      .filter((name) => !words.has(name) && !EXTERNAL_CLASSES.includes(name) && !DYNAMIC_PREFIXES.some((prefix) => name.startsWith(prefix)))
      .map((name) => `${relative(SRC, file)}: .${name}`))
    expect(unused).toEqual([])
  })

  it('read only defined custom properties', () => {
    const defined = new Set<string>()
    for (const file of allCss) for (const match of stripComments(readFileSync(file, 'utf8')).matchAll(/(--[\w-]+)\s*:/g)) defined.add(match[1])
    // Inline styles and DS components set some properties from code: style={{ '--progress': … }}.
    for (const file of sources) for (const match of readFileSync(file, 'utf8').matchAll(/['"](--[\w-]+)['"]\s*:/g)) defined.add(match[1])
    const missing = allCss.flatMap((file) => [...stripComments(readFileSync(file, 'utf8')).matchAll(/var\(\s*(--[\w-]+)/g)]
      .map((match) => match[1])
      .filter((name) => !defined.has(name))
      .map((name) => `${relative(SRC, file)}: ${name}`))
    expect([...new Set(missing)]).toEqual([])
  })
})
