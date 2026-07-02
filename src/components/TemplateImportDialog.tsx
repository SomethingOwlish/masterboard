// Template import wizard. The GM downloads a blank JSON template (or copies a
// prompt to have an LLM fill it from a prose / HTML doc), pastes or uploads the
// filled file, sees a per-section summary, and commits. Deterministic — the
// structure is explicit, so nothing is guessed. Replaces the old heuristic
// document parser. See lib/importTemplate.ts + store/importing.commitTemplate.

import { useEffect, useMemo, useState } from 'react'
import {
  blankTemplate,
  isTemplateEmpty,
  llmFillPrompt,
  parseTemplate,
  SECTION_KEYS,
  templateCounts,
} from '../lib/importTemplate'
import { commitTemplate, type TemplateResult } from '../store/importing'
import { Button } from '../ds'

function download(filename: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function TemplateImportDialog({
  campaignId,
  onClose,
  onDone,
}: {
  campaignId: string
  onClose: () => void
  onDone: (r: TemplateResult) => void
}) {
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Esc closes, consistent with the other dialogs (B10).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Parse on every edit so the summary + errors stay live. Only surface a JSON
  // syntax error once the GM has actually typed something.
  const parsed = useMemo(() => {
    const trimmed = text.trim()
    if (!trimmed) return null
    try {
      return parseTemplate(JSON.parse(trimmed))
    } catch (e) {
      return { syntax: e instanceof Error ? e.message : 'Invalid JSON.' }
    }
  }, [text])

  const isSyntaxError = parsed !== null && 'syntax' in parsed
  const result = parsed && !('syntax' in parsed) ? parsed : null
  const counts = result ? templateCounts(result) : null
  const total = counts ? SECTION_KEYS.reduce((n, k) => n + counts[k], 0) : 0
  const canImport = !!result && !isTemplateEmpty(result) && !importing

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setText(await file.text())
    e.target.value = '' // allow re-selecting the same file
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(llmFillPrompt())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (e.g. insecure context) — fall back to downloading it.
      download('masterboard-import-prompt.txt', llmFillPrompt(), 'text/plain')
    }
  }

  async function run() {
    if (!result) return
    setImporting(true)
    setError(null)
    try {
      onDone(await commitTemplate(campaignId, result))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
      setImporting(false)
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal import-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 style={{ marginTop: 0 }}>Import from template</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Download the template and fill it in, or copy the prompt to have an AI convert an existing document into it.
          Then paste or upload the filled file below.
        </p>

        <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            icon="download"
            onClick={() => download('masterboard-import-template.json', JSON.stringify(blankTemplate(), null, 2))}
          >
            Download template
          </Button>
          <Button icon={copied ? 'check' : 'clipboard'} onClick={() => void copyPrompt()}>
            {copied ? 'Prompt copied' : 'Copy AI prompt'}
          </Button>
          <label className="button-link" style={{ cursor: 'pointer' }}>
            Upload file…
            <input type="file" accept=".json,application/json" onChange={(e) => void onFile(e)} style={{ display: 'none' }} />
          </label>
        </div>

        <div className="field" style={{ marginTop: '0.75rem' }}>
          <label>Filled template JSON</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the filled template here, or use Upload file…"
            rows={10}
            spellCheck={false}
            style={{ width: '100%', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.85rem' }}
          />
        </div>

        {isSyntaxError && <p className="image-field-error">Not valid JSON: {(parsed as { syntax: string }).syntax}</p>}

        {result && (
          <div className="import-summary">
            <p className="muted" style={{ margin: '0 0 0.25rem' }}>
              {total === 0 ? 'No entities found — every section is empty.' : `${total} entit${total === 1 ? 'y' : 'ies'} to import:`}
            </p>
            {total > 0 && (
              <ul className="import-counts">
                {SECTION_KEYS.filter((k) => counts![k] > 0).map((k) => (
                  <li key={k}>
                    <strong>{counts![k]}</strong> {k}
                  </li>
                ))}
              </ul>
            )}
            {result.errors.length > 0 && (
              <ul className="import-warnings">
                {result.errors.map((msg, i) => (
                  <li key={i}>⚠ {msg}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <p className="image-field-error">{error}</p>}

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '0.75rem', gap: '0.5rem' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button className="primary" onClick={() => void run()} disabled={!canImport}>
            {importing ? 'Importing…' : total > 0 ? `Import ${total}` : 'Import'}
          </Button>
        </div>
      </div>
    </div>
  )
}
