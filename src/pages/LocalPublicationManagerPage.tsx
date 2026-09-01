import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Icon } from '../ds'
import { localPublicationDemo } from '../fixtures/localDemoRuntime'
import type { PublicationManagerSnapshot, StoredPublicationItem } from '../storage/publicationManager'

const STATE_TONE: Record<StoredPublicationItem['state'], 'neutral' | 'accent' | 'success' | 'danger' | 'warning'> = {
  draft: 'neutral', ready: 'accent', blocked: 'warning', succeeded: 'success', failed: 'danger',
}

function entityLabel(item: StoredPublicationItem) {
  return item.entityId === 'entity-silver-fox' ? 'The Silver Fox' : item.entityId === 'entity-red-moon-rumor' ? 'The Red Moon Collects Debts' : item.entityId
}

export function LocalPublicationManagerPage() {
  const demo = useMemo(() => localPublicationDemo, [])
  const [snapshot, setSnapshot] = useState<PublicationManagerSnapshot | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [inspected, setInspected] = useState<StoredPublicationItem | null>(null)
  const [sendPrompt, setSendPrompt] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = useCallback(() => demo.snapshot().then(setSnapshot), [demo])
  useEffect(() => { void reload().catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load publication queue')) }, [reload])

  const run = async (work: () => Promise<PublicationManagerSnapshot>, success: string) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const next = await work()
      setSnapshot(next)
      setSelected([])
      setInspected((current) => current ? [...next.active, ...next.history].find((item) => item.id === current.id) ?? null : null)
      setNotice(success)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Publication action failed')
    } finally {
      setBusy(false)
    }
  }

  if (!snapshot) return <main className="publication-manager"><p className="muted">Loading publication queue…</p></main>
  const selectedItems = snapshot.active.filter((item) => selected.includes(item.id))
  const readyToConfirm = selectedItems.filter((item) => item.state === 'ready' && !item.confirmedAt)
  const failedToRetry = selectedItems.filter((item) => item.state === 'failed')
  const confirmed = snapshot.active.filter((item) => item.state === 'ready' && item.confirmedAt)

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  return (
    <main className="publication-manager">
      <header className="publication-manager__topbar">
        <div className="row target-demo-links"><Link to="/demo/campaign" className="row muted"><Icon name="layout-dashboard" size={16} /> Dashboard</Link><Link to="/demo/library" className="row muted"><Icon name="library" size={16} /> Library</Link></div>
        <Badge tone="neutral" dot>Simulation only · fake destination</Badge>
      </header>

      <section className="publication-manager__heading">
        <div><span className="panel-kicker">Moon Port workspace</span><h1>Publication manager</h1><p>Review exactly what would change before an explicit send.</p></div>
        <div className="publication-manager__summary"><strong>{snapshot.active.length}</strong><span>active operations</span><strong>{snapshot.history.length}</strong><span>completed</span></div>
      </section>

      {error && <p className="local-session-error" role="alert">{error}</p>}
      {notice && <p className="publication-manager__notice" role="status"><Icon name="check" size={16} /> {notice}</p>}

      <section className="publication-manager__workflow" aria-label="Publication workflow">
        <div className={`publication-step ${snapshot.counts.draft ? 'current' : 'done'}`}><span>1</span><div><strong>Preview</strong><small>{snapshot.counts.draft ? `${snapshot.counts.draft} drafts` : 'Capabilities checked'}</small></div></div>
        <div className={`publication-step ${snapshot.counts.ready ? 'current' : snapshot.counts.draft ? '' : 'done'}`}><span>2</span><div><strong>Confirm</strong><small>{confirmed.length ? `${confirmed.length} confirmed` : `${snapshot.counts.ready} ready`}</small></div></div>
        <div className={`publication-step ${confirmed.length ? 'current' : ''}`}><span>3</span><div><strong>Fake send</strong><small>Always manual</small></div></div>
      </section>

      <div className="publication-manager__actions">
        <Button icon="search" disabled={!snapshot.counts.draft || busy} onClick={() => void run(() => demo.preview(), 'Capability preview complete. Nothing was sent.')}>Preview drafts</Button>
        <Button variant="primary" icon="check" disabled={!readyToConfirm.length || busy} onClick={() => void run(() => demo.confirm(readyToConfirm.map((item) => item.id)), `${readyToConfirm.length} operation(s) confirmed for this fake batch.`)}>Confirm selected</Button>
        <Button tone="danger" icon="refresh-cw" disabled={!failedToRetry.length || busy} onClick={() => void run(() => demo.retry(failedToRetry.map((item) => item.id)), `${failedToRetry.length} failed operation(s) returned to ready.`)}>Retry selected</Button>
        <Button variant="primary" tone="success" icon="upload" disabled={!confirmed.length || busy} onClick={() => setSendPrompt(true)}>Send confirmed ({confirmed.length})</Button>
      </div>

      <div className={`publication-manager__workspace ${inspected ? 'has-inspector' : ''}`}>
        <section>
          <Card className="publication-destination" padding="0">
            <header><div><span className="panel-kicker">Fake Lovegame destination</span><h2>Moon Port campaign</h2></div><Badge tone="accent">{demo.connection.label}</Badge></header>
            <div className="publication-table" role="table" aria-label="Active publication operations">
              <div className="publication-row publication-row--head" role="row"><span /><span>Entity</span><span>Operation</span><span>Change</span><span>State</span></div>
              {snapshot.active.map((item) => {
                const canSelect = (item.state === 'ready' && !item.confirmedAt) || item.state === 'failed'
                return (
                  <button key={item.id} className={`publication-row ${inspected?.id === item.id ? 'is-inspected' : ''}`} role="row" onClick={() => setInspected(item)}>
                    <span onClick={(event) => event.stopPropagation()}>{canSelect ? <input aria-label={`Select ${entityLabel(item)}`} type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} /> : null}</span>
                    <span data-label="Entity"><strong>{entityLabel(item)}</strong><small>{item.entityType}</small></span>
                    <span data-label="Operation">{item.operation}</span>
                    <span data-label="Change" className="mb-data">{Object.keys(item.patch).join(', ')}</span>
                    <span data-label="State"><Badge tone={STATE_TONE[item.state]} size="sm" dot>{item.confirmedAt && item.state === 'ready' ? 'confirmed' : item.state}</Badge></span>
                  </button>
                )
              })}
            </div>
          </Card>

          <button className="publication-history-toggle" onClick={() => setShowHistory((value) => !value)}><span><Icon name="history" size={16} /> History</span><span>{snapshot.history.length} {showHistory ? '−' : '+'}</span></button>
          {showHistory && <div className="publication-history">{snapshot.history.length ? snapshot.history.map((item) => <div key={item.id}><span>{entityLabel(item)} · {item.operation}</span><Badge tone="success" size="sm">succeeded</Badge></div>) : <p className="muted">No completed fake operations yet.</p>}</div>}
        </section>

        {inspected && (
          <aside className="publication-inspector">
            <button className="target-inspector__close" aria-label="Close inspector" onClick={() => setInspected(null)}>×</button>
            <span className="panel-kicker">Operation diff</span>
            <h2>{entityLabel(inspected)}</h2>
            <div className="target-inspector__origins"><Badge tone={STATE_TONE[inspected.state]}>{inspected.state}</Badge><Badge tone="accent">Fake Lovegame</Badge></div>
            <dl className="target-inspector__facts"><dt>Operation</dt><dd>{inspected.operation}</dd><dt>Entity type</dt><dd>{inspected.entityType}</dd><dt>Destination</dt><dd>Moon Port</dd></dl>
            <div className="publication-diff">
              <div className="publication-diff__head"><span>Field</span><span>Would become</span></div>
              {Object.entries(inspected.patch).map(([field, value]) => <div key={field}><code>{field}</code><strong>{JSON.stringify(value)}</strong></div>)}
            </div>
            {inspected.error && <div className="publication-inspector__error"><strong>Needs attention</strong><p>{inspected.error}</p></div>}
            <p className="muted target-inspector__note">This inspector shows a simulation. No external data is changed.</p>
          </aside>
        )}
      </div>

      {sendPrompt && (
        <div className="publication-send-scrim" role="presentation" onMouseDown={() => setSendPrompt(false)}>
          <section className="publication-send-confirm" role="dialog" aria-modal="true" aria-labelledby="fake-send-title" onMouseDown={(event) => event.stopPropagation()}>
            <Badge tone="warning" icon="triangle-alert">Simulation boundary</Badge>
            <h2 id="fake-send-title">Run fake publication batch?</h2>
            <p>{confirmed.length} confirmed operation(s) will be passed to the deterministic fake adapter. One configured row will fail so partial-result handling can be tested.</p>
            <div className="publication-send-list">{confirmed.map((item) => <span key={item.id}>{entityLabel(item)} · {item.operation}</span>)}</div>
            <div className="row"><Button variant="primary" tone="success" icon="upload" disabled={busy} onClick={() => { setSendPrompt(false); void run(() => demo.execute(), 'Fake batch completed. Successes moved to history; failures remain active.') }}>Run fake send</Button><Button variant="ghost" onClick={() => setSendPrompt(false)}>Cancel</Button></div>
          </section>
        </div>
      )}

      <p className="local-session-footnote">No external request can leave this screen. Reload resets the full simulated queue.</p>
    </main>
  )
}

