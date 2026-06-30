// Rules module (M11 / B9). A markdown workspace for mechanics & house rules:
// a headings sidebar (with section search), an editable source pane, and a live
// rendered preview. Dependency-light by decision — the renderer is hand-rolled
// (src/lib/markdown.ts) rather than pulling in a full editor stack. Edits autosave
// through the rules store; rules.md is a real markdown file in the repo.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { extractHeadings, renderMarkdown, searchSections } from '../lib/markdown'
import { useRules } from '../store/rules'

type Mode = 'split' | 'write' | 'preview'

const PLACEHOLDER = `# House rules

Start typing your campaign's rules in **Markdown**.

## Combat
- Initiative is rolled once per encounter.
- Critical hits deal *double* dice.

## Resting
> A long rest requires a safe haven.
`

export function RulesPage() {
  const { campaignId } = useParams()
  const markdown = useRules((s) => s.markdown)
  const loading = useRules((s) => s.loading)
  const saving = useRules((s) => s.saving)
  const load = useRules((s) => s.load)
  const setMarkdown = useRules((s) => s.setMarkdown)
  const flush = useRules((s) => s.flush)

  const [mode, setMode] = useState<Mode>('split')
  const [query, setQuery] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (campaignId) void load(campaignId)
  }, [campaignId, load])

  // Flush any pending debounced save when leaving the page.
  useEffect(() => () => void flush(), [flush])

  const headings = useMemo(() => extractHeadings(markdown), [markdown])
  const matches = useMemo(() => searchSections(markdown, query), [markdown, query])
  const html = useMemo(() => renderMarkdown(markdown || ''), [markdown])

  const shownHeadings = query ? headings.filter((h) => matches.has(h.slug) || h.text.toLowerCase().includes(query.toLowerCase())) : headings

  function jumpTo(slug: string) {
    if (mode === 'write') setMode('split')
    // Defer so the preview pane exists if we just switched modes.
    requestAnimationFrame(() => {
      const el = previewRef.current?.querySelector(`#${CSS.escape(slug)}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="content rules-page">
      <div className="row no-print" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>
          <span aria-hidden>📖</span> Rules
        </h1>
        <div className="row" style={{ gap: '0.5rem' }}>
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            {saving ? 'Saving…' : loading ? 'Loading…' : 'Saved'}
          </span>
          <div className="seg">
            {(['write', 'split', 'preview'] as Mode[]).map((m) => (
              <button
                key={m}
                className={mode === m ? 'active' : ''}
                onClick={() => setMode(m)}
              >
                {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rules-body">
        <aside className="rules-toc no-print">
          <input
            className="rules-search"
            value={query}
            placeholder="Search rules…"
            onChange={(e) => setQuery(e.target.value)}
          />
          {shownHeadings.length === 0 ? (
            <p className="muted" style={{ fontSize: '0.85rem', padding: '0 0.25rem' }}>
              {headings.length === 0 ? 'No headings yet.' : 'No sections match.'}
            </p>
          ) : (
            <nav className="rules-toc-list">
              {shownHeadings.map((h) => (
                <button
                  key={h.slug}
                  className="rules-toc-item"
                  style={{ paddingLeft: `${0.3 + (h.level - 1) * 0.7}rem` }}
                  onClick={() => jumpTo(h.slug)}
                >
                  {h.text}
                </button>
              ))}
            </nav>
          )}
        </aside>

        <div className={`rules-panes mode-${mode}`}>
          {mode !== 'preview' && (
            <textarea
              className="rules-editor"
              value={markdown}
              placeholder={PLACEHOLDER}
              onChange={(e) => setMarkdown(e.target.value)}
              spellCheck
            />
          )}
          {mode !== 'write' && (
            <div className="rules-preview" ref={previewRef}>
              {markdown.trim() ? (
                <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <p className="muted">Nothing to preview yet. Start writing on the left.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
