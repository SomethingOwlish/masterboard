// Connected-site panel (M2 + M-imports / B8). Lists the campaign's source sites,
// links out to each, and pulls data in: "Import" opens the mapping wizard, which
// fetches the site's JSON and creates entities from it. Sites are added/removed
// here and stored in campaign.settings.sourceSites.

import { useState } from 'react'
import { newId } from '../model/ids'
import type { SourceSite } from '../model/types'
import { useCampaign } from '../store/campaign'
import type { ImportResult } from '../store/importing'
import { ImportDialog } from './ImportDialog'

export function SourcePanel({ campaignId, sites }: { campaignId: string; sites: SourceSite[] }) {
  const updateSettings = useCampaign((s) => s.updateSettings)
  const [importing, setImporting] = useState<SourceSite | null>(null)
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
      <h2 className="section-title">🔗 Connected sites</h2>

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
                <button onClick={() => { setResult(null); setImporting(s) }}>Import</button>
                <a className="button-link" href={s.url} target="_blank" rel="noreferrer noopener">Open ↗</a>
                <button className="ghost" aria-label={`Remove ${s.label}`} onClick={() => removeSite(s.id)}>🗑</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="source-add">
        <input value={label} placeholder="Label (e.g. Wiki)" onChange={(e) => setLabel(e.target.value)} />
        <input value={url} placeholder="https://…/data.json" onChange={(e) => setUrl(e.target.value)} />
        <button onClick={addSite} disabled={!label.trim() || !url.trim()}>+ Add</button>
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
    </section>
  )
}
