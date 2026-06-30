// Settings (B1): GitHub sync coordinates + the fine-grained PAT. The token is
// stored encrypted in IndexedDB (never in localStorage, never committed); only a
// presence flag is surfaced after save. Per-campaign settings (theme, sources,
// task site, storage overrides) arrive with their owning modules in later batches.

import { useEffect, useState } from 'react'
import { GitHubStorageAdapter } from '../adapters/github'
import { useConfig } from '../store/config'
import { Icon, Button } from '../ds'

export function SettingsPage() {
  const { config, token, tokenLoaded, saveConfig, saveToken, clearTokenValue, hydrate } = useConfig()
  const [form, setForm] = useState(config)
  const [tokenInput, setTokenInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    if (!tokenLoaded) void hydrate()
  }, [tokenLoaded, hydrate])

  useEffect(() => setForm(config), [config])

  const onField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const saveAll = async () => {
    saveConfig(form)
    if (tokenInput) {
      await saveToken(tokenInput.trim())
      setTokenInput('')
    }
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  const verify = async () => {
    setVerifying(true)
    setVerifyMsg(null)
    const effectiveToken = tokenInput.trim() || token
    if (!effectiveToken || !form.owner || !form.repo) {
      setVerifyMsg({ ok: false, text: 'Enter owner, repo, and a token first.' })
      setVerifying(false)
      return
    }
    const adapter = new GitHubStorageAdapter({
      token: effectiveToken,
      owner: form.owner,
      repo: form.repo,
      branch: form.branch || 'main',
    })
    const result = await adapter.verify()
    setVerifyMsg({ ok: result.ok, text: result.message })
    setVerifying(false)
  }

  const clearTok = async () => {
    await clearTokenValue()
    setTokenInput('')
  }

  return (
    <div className="content" style={{ maxWidth: 640 }}>
      <h1 className="row" style={{ marginTop: 0, gap: '0.5rem' }}>
        <Icon name="settings" size={24} /> Settings
      </h1>
      <p className="muted">
        Masterboard works fully offline using your browser's storage. Connect a GitHub repo to sync
        across devices and keep version history. Nothing here is committed to the repo.
      </p>

      <section className="card" style={{ marginTop: '1rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>GitHub sync</h2>

        <div className="field">
          <label htmlFor="gm">GM handle</label>
          <input id="gm" value={form.gmHandle} onChange={onField('gmHandle')} placeholder="your-folder-name" />
          <small className="muted">Top-level folder that isolates your campaigns in the shared repo.</small>
        </div>

        <div className="row" style={{ gap: '1rem', alignItems: 'flex-start' }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="owner">Repo owner</label>
            <input id="owner" value={form.owner} onChange={onField('owner')} placeholder="github-user-or-org" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="repo">Repo name</label>
            <input id="repo" value={form.repo} onChange={onField('repo')} placeholder="our-campaigns" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="branch">Branch</label>
          <input id="branch" value={form.branch} onChange={onField('branch')} placeholder="main" />
        </div>

        <div className="field">
          <label htmlFor="token">Fine-grained PAT {token && <span className="muted">· a token is saved</span>}</label>
          <input
            id="token"
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder={token ? '•••••••• (leave blank to keep)' : 'github_pat_…'}
            autoComplete="off"
          />
          <small className="muted">
            Needs Contents read/write on the repo. Stored encrypted in IndexedDB on this device only.
          </small>
        </div>

        <div className="row" style={{ marginTop: '0.75rem' }}>
          <Button variant="primary" icon="check" onClick={saveAll}>Save</Button>
          <Button icon="refresh-cw" onClick={verify} disabled={verifying}>{verifying ? 'Checking…' : 'Test connection'}</Button>
          {token && <Button variant="ghost" onClick={clearTok}>Clear token</Button>}
          {savedFlash && <span className="muted row" style={{ gap: '0.3rem' }}><Icon name="check" size={15} /> Saved</span>}
        </div>

        {verifyMsg && (
          <p className="row" style={{ marginBottom: 0, gap: '0.3rem', color: verifyMsg.ok ? 'var(--success)' : 'var(--danger)' }}>
            <Icon name={verifyMsg.ok ? 'check' : 'x'} size={15} />
            {verifyMsg.text}
          </p>
        )}
      </section>

      <section className="card" style={{ marginTop: '1rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Images (Imgur)</h2>
        <div className="field">
          <label htmlFor="imgur">Imgur client ID</label>
          <input id="imgur" value={form.imgurClientId} onChange={onField('imgurClientId')} placeholder="e.g. 1a2b3c4d5e6f7g8" />
          <small className="muted">
            Enables one-click portrait / cover / image uploads. Register a free app at
            api.imgur.com (OAuth2 without a callback URL) and paste its Client ID. Without it, image
            fields fall back to pasting a URL.
          </small>
        </div>
        <div className="row">
          <button className="primary" onClick={saveAll}>Save</button>
        </div>
      </section>
    </div>
  )
}
