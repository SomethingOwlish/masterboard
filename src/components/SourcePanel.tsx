// Connected-site panel (M2 + M-imports / B8). Lists the campaign's source sites,
// links out to each, and pulls data in: "Import" opens the mapping wizard, which
// fetches the site's JSON and creates entities from it. Sites are added/removed
// here and stored in campaign.settings.sourceSites. "Import template" opens the
// template importer: download a blank JSON template (or an AI prompt to fill it
// from an existing document), then upload the filled file for a deterministic,
// whole-campaign import.

import { useState } from 'react'
import { newId } from '../model/ids'
import type { SourceSite } from '../model/types'
import { useCampaign } from '../store/campaign'
import type { ImportResult, TemplateResult } from '../store/importing'
import { TemplateImportDialog } from './TemplateImportDialog'
import { ImportDialog } from './ImportDialog'
import { Icon, Button, IconButton } from '../ds'

function summarize(r: TemplateResult): string {
  const parts = Object.entries(r.bySection).map(([k, n]) => `${n} ${k}`)
  const detail = parts.length ? ` (${parts.join(', ')})` : ''
  return `Imported ${r.imported}${detail}${r.skipped ? `, skipped ${r.skipped} (duplicate or unnamed)` : ''}.`
}

export function SourcePanel({ campaignId, sites }: { campaignId: string; sites: SourceSite[] }) {
  const updateSettings = useCampaign((s) => s.updateSettings)
  const [importing, setImporting] = useState<SourceSite | null>(null)
  const [parsingDoc, setParsingDoc] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')

  function addSite() {
    const l = label.trim()
    const u = url.trim()
    if (!l || !u) return
    void updateSettings({ sourceSites: [...sites, { id: newId('src'), label: l, url: u }] })
    setLabel('')
    setUrl('')
  }

  function removeSite(id: string) {
    void updateSettings({ sourceSites: sites.filter((s) => s.id !== id) })
  }

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="section-title row" style={{ gap: '0.4rem', margin: 0 }}><Icon name="link" size={18} /> Connected sites</h2>
        <Button size="sm" icon="scroll-text" onClick={() => { setResult(null); setParsingDoc(true) }}>
          Import template
        </Button>
      </div>

      {sites.length === 0 ? (
        <p className="muted" style={{ marginTop: 0 }}>
          No source sites yet. Add one that serves JSON (e.g. a GitHub Pages file) to pull data in.
        </p>
      ) : (
        <ul className="source-list">
          {sites.map((s) => (
            <li key={s.id} className="source-row">
              <span className="source-label">{s.label}</span>
              <div className="row" style={{ gap: '0.4rem' }}>
                <Button size="sm" icon="download" onClick={() => { setResult(null); setImporting(s) }}>Import</Button>
                <a className="button-link" href={s.url} target="_blank" rel="noreferrer noopener">Open ↗</a>
                <IconButton icon="trash-2" label={`Remove ${s.label}`} size="sm" tone="danger" onClick={() => removeSite(s.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="source-add">
        <input value={label} placeholder="Label (e.g. Wiki)" onChange={(e) => setLabel(e.target.value)} />
        <input value={url} placeholder="https://…/data.json" onChange={(e) => setUrl(e.target.value)} />
        <Button icon="plus" onClick={addSite} disabled={!label.trim() || !url.trim()}>Add</Button>
      </div>

      {result && <p className="muted" style={{ margin: '0.5rem 0 0' }}>{result}</p>}

      {importing && (
        <ImportDialog
          url={importing.url}
          label={importing.label}
          campaignId={campaignId}
          onClose={() => setImporting(null)}
          onDone={(r: ImportResult) => {
            setImporting(null)
            setResult(`Imported ${r.imported}${r.skipped ? `, skipped ${r.skipped} (duplicate or unnamed)` : ''}.`)
          }}
        />
      )}

      {parsingDoc && (
        <TemplateImportDialog
          campaignId={campaignId}
          onClose={() => setParsingDoc(false)}
          onDone={(r: TemplateResult) => {
            setParsingDoc(false)
            setResult(summarize(r))
          }}
        />
      )}
    </section>
  )
}
