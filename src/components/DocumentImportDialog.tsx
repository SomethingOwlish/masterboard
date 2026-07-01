// Document import wizard (B-import). The unstructured sibling of the JSON import
// dialog (B8): the GM pastes or uploads a generated document (Markdown, HTML, or
// SVG), the parser splits it into candidate blocks, and this wizard lets the GM
// route each block to a module — Character, NPC, Location, Misc, or a Timeline
// event — before committing. Each block is confirmed individually, so one document
// can seed several modules at once.

import { useEffect, useMemo, useState } from 'react'
import { detectFormat, parseDocument, type DocFormat } from '../lib/docParse'
import { newId } from '../model/ids'
import { commitRoutedEntities, guessRoute, type ImportResult, type RouteKind } from '../store/importing'

const FORMAT_OPTIONS: { value: DocFormat; label: string }[] = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'html', label: 'HTML' },
  { value: 'svg', label: 'SVG' },
]

const ROUTE_OPTIONS: { value: RouteKind; label: string }[] = [
  { value: 'skip', label: '— skip —' },
  { value: 'pc', label: 'Character' },
  { value: 'npc', label: 'NPC' },
  { value: 'location', label: 'Location' },
  { value: 'misc', label: 'Misc' },
  { value: 'timeline', label: 'Timeline event' },
]

/** A parsed block plus the GM's in-progress routing choices (UI row state). */
interface Row {
  id: string
  route: RouteKind
  name: string
  body: string
  image?: string
  miscKind: string
  date: string
}

export function DocumentImportDialog({
  campaignId,
  onClose,
  onDone,
}: {
  campaignId: string
  onClose: () => void
  onDone: (r: ImportResult) => void
}) {
  const [phase, setPhase] = useState<'input' | 'route' | 'importing'>('input')
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [format, setFormat] = useState<DocFormat>('markdown')
  const [rows, setRows] = useState<Row[]>([])

  // Esc closes, consistent with the JSON import dialog and the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function onFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result ?? '')
      setText(content)
      setFormat(detectFormat(content, file.name))
    }
    reader.readAsText(file)
  }

  function parse() {
    setError(null)
    try {
      const blocks = parseDocument(text, format)
      if (blocks.length === 0) {
        setError('No content blocks found. Try a different format, or check the document.')
        return
      }
      setRows(
        blocks.map((b) => {
          const g = guessRoute(b.title, b.body)
          return {
            id: newId('row'),
            route: g.route,
            name: b.title || b.body.slice(0, 60),
            body: b.body,
            image: b.image,
            miscKind: g.miscKind ?? 'note',
            date: '',
          }
        }),
      )
      setPhase('route')
    } catch {
      setError('Could not parse the document.')
    }
  }

  const set = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const includedCount = useMemo(() => rows.filter((r) => r.route !== 'skip' && r.name.trim()).length, [rows])

  async function run() {
    if (includedCount === 0) return
    setPhase('importing')
    setError(null)
    try {
      const result = await commitRoutedEntities(
        campaignId,
        rows.map((r) => ({
          route: r.route,
          name: r.name,
          body: r.body,
          tags: [],
          image: r.image,
          miscKind: r.miscKind,
          date: r.date,
        })),
      )
      onDone(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
      setPhase('route')
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal import-dialog doc-import-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 style={{ marginTop: 0 }}>Import from document</h2>

        {phase === 'input' ? (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Paste a generated document or choose a file. Markdown, HTML, and SVG are supported — each section becomes a
              block you can route to a module.
            </p>

            <div className="field">
              <label>Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as DocFormat)}>
                {FORMAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>File</label>
              <input
                type="file"
                accept=".md,.markdown,.txt,.html,.htm,.svg,text/markdown,text/html,image/svg+xml"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </div>

            <div className="field">
              <label>Or paste content</label>
              <textarea
                className="doc-import-input"
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  setFormat((f) => (text ? f : detectFormat(e.target.value)))
                }}
                placeholder="# The Sunken City&#10;A drowned metropolis beneath the bay…"
                rows={8}
              />
            </div>

            {error && <p className="image-field-error">{error}</p>}

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button onClick={onClose}>Cancel</button>
              <button className="primary" onClick={parse} disabled={!text.trim()}>
                Parse
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              {rows.length} block(s) found · {includedCount} will import. Route each block, edit its name, then import.
            </p>

            <div className="doc-import-rows">
              {rows.map((r) => (
                <div key={r.id} className={`doc-import-row${r.route === 'skip' ? ' is-skipped' : ''}`}>
                  <div className="doc-import-row-main">
                    <select
                      className="doc-import-route"
                      value={r.route}
                      onChange={(e) => set(r.id, { route: e.target.value as RouteKind })}
                    >
                      {ROUTE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="doc-import-name"
                      value={r.name}
                      onChange={(e) => set(r.id, { name: e.target.value })}
                      placeholder="Name"
                    />
                    {r.route === 'misc' && (
                      <input
                        className="doc-import-extra"
                        value={r.miscKind}
                        onChange={(e) => set(r.id, { miscKind: e.target.value })}
                        placeholder="kind (e.g. faction)"
                      />
                    )}
                    {r.route === 'timeline' && (
                      <input
                        className="doc-import-extra"
                        value={r.date}
                        onChange={(e) => set(r.id, { date: e.target.value })}
                        placeholder="date (e.g. 1247 AD)"
                      />
                    )}
                  </div>
                  {r.body && <p className="doc-import-body muted">{r.body.slice(0, 160)}{r.body.length > 160 ? '…' : ''}</p>}
                </div>
              ))}
            </div>

            {error && <p className="image-field-error">{error}</p>}

            <div className="row" style={{ justifyContent: 'space-between', marginTop: '0.75rem' }}>
              <button onClick={() => setPhase('input')} disabled={phase === 'importing'}>
                ← Back
              </button>
              <div className="row" style={{ gap: '0.5rem' }}>
                <button onClick={onClose}>Cancel</button>
                <button className="primary" onClick={() => void run()} disabled={includedCount === 0 || phase === 'importing'}>
                  {phase === 'importing' ? 'Importing…' : `Import ${includedCount}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
