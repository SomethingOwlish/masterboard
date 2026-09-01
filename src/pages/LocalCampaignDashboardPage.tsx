import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Icon } from '../ds'
import type { LocalDashboardSnapshot } from '../fixtures/localDashboardDemo'
import { localDashboardDemo } from '../fixtures/localDemoRuntime'

export function LocalCampaignDashboardPage() {
  const demo = useMemo(() => localDashboardDemo, [])
  const [snapshot, setSnapshot] = useState<LocalDashboardSnapshot | null>(null)
  const [capture, setCapture] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => demo.load().then(setSnapshot), [demo])
  useEffect(() => { void reload().catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load dashboard')) }, [reload])

  const act = async (work: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try { await work(); await reload() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Action failed') } finally { setBusy(false) }
  }

  const addCapture = () => {
    const text = capture.trim()
    if (!text) return
    void act(() => demo.captureInbox(text)).then(() => setCapture(''))
  }

  if (!snapshot) return <main className="target-dashboard"><p className="muted">Loading Moon Port…</p></main>
  const { campaign, session, lines, clocks, secrets, tasks, inbox } = snapshot

  return (
    <main className="target-dashboard">
      <header className="target-dashboard__topbar">
        <div className="row target-demo-links"><Link to="/" className="row muted"><Icon name="arrow-left" size={16} /> Campaigns</Link><Link to="/demo/library" className="row muted"><Icon name="library" size={16} /> Library</Link></div>
        <div className="row"><Badge tone="neutral" dot>Local fake workspace</Badge><span className="target-dashboard__master">Owl + Fox</span></div>
      </header>

      <section className="target-dashboard__hero">
        <div>
          <span className="panel-kicker">Campaign dashboard</span>
          <h1>{campaign.name}</h1>
          <p>{campaign.idea}</p>
        </div>
        <div className="target-dashboard__time"><span>Active time</span><strong>{campaign.activeTime}</strong></div>
      </section>
      {error && <p className="local-session-error" role="alert">{error}</p>}

      <section className="target-dashboard__session">
        <div>
          <span className="panel-kicker">Current session</span>
          <h2>{session?.title ?? 'No session selected'}</h2>
          <p>{String(session?.plan.objective ?? '')}</p>
        </div>
        <div className="target-dashboard__session-action">
          <Badge tone="warning" dot>{session?.status ?? 'none'}</Badge>
          <Link to="/demo/session" className="button-link primary"><Icon name="clapperboard" size={16} /> Open session</Link>
        </div>
      </section>

      <div className="target-dashboard__grid">
        <Card className="target-panel target-panel--wide">
          <div className="panel-heading"><div><span className="panel-kicker">Campaign motion</span><h2 className="section-title">Active lines</h2></div><span className="panel-state">{lines.length} active</span></div>
          <div className="target-lines">
            {lines.map((line) => <article key={line.title}><div><Badge tone="accent" size="sm">{line.state}</Badge><h3>{line.title}</h3><p>{line.direction}</p></div><strong>{line.stakes}</strong></article>)}
          </div>
        </Card>

        <Card className="target-panel">
          <div className="panel-heading"><div><span className="panel-kicker">Pressure</span><h2 className="section-title">Clocks</h2></div></div>
          {clocks.map((clock) => <div className="target-clock" key={clock.title}><div className="row"><strong>{clock.title}</strong><span className="mb-data">{clock.value}/{clock.max}</span></div><div className="target-clock__track"><span style={{ width: `${(clock.value / clock.max) * 100}%` }} /></div><small>{clock.visibleToPlayers ? 'Visible to players' : 'Master only'}</small></div>)}
        </Card>

        <Card className="target-panel">
          <div className="panel-heading"><div><span className="panel-kicker">Knowledge</span><h2 className="section-title">Secrets</h2></div><span className="panel-state">{secrets.length} hidden</span></div>
          {secrets.map((secret) => <article className="target-secret" key={secret.title}><Badge tone="warning" icon="shield" size="sm">{secret.state}</Badge><h3>{secret.title}</h3><p>{secret.truth}</p><small>Reveal: {secret.revealConditions.join(', ')}</small></article>)}
        </Card>

        <Card className="target-panel">
          <div className="panel-heading"><div><span className="panel-kicker">Personal</span><h2 className="section-title">GM checklist</h2></div><span className="panel-state">{tasks.filter((task) => task.state !== 'done').length} open</span></div>
          <ul className="target-checklist">
            {tasks.sort((a, b) => a.order - b.order).map((task) => <li key={task.id}><input id={`task-${task.id}`} type="checkbox" checked={task.state === 'done'} disabled={busy} onChange={() => void act(() => demo.toggleTask(task.id))} /><label htmlFor={`task-${task.id}`}>{task.title}</label><Badge tone={task.state === 'doing' ? 'accent' : 'neutral'} size="sm">{task.state}</Badge></li>)}
          </ul>
        </Card>

        <Card className="target-panel">
          <div className="panel-heading"><div><span className="panel-kicker">Quick capture</span><h2 className="section-title">Inbox</h2></div><span className="panel-state">{inbox.length}</span></div>
          <div className="target-capture"><input id="dashboard-capture" name="dashboard-capture" value={capture} placeholder="Capture an idea without classifying it…" onChange={(event) => setCapture(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addCapture() }} /><Button variant="primary" icon="plus" disabled={busy || !capture.trim()} onClick={addCapture}>Capture</Button></div>
          <ol className="target-inbox">{[...inbox].sort((a, b) => a.order - b.order).map((item) => <li key={item.id}><span>{item.text}</span><Badge tone="neutral" size="sm">{item.targetType}</Badge></li>)}</ol>
        </Card>
      </div>

      <p className="local-session-footnote">This campaign is deterministic and in-memory. Reload to reset all quick updates.</p>
    </main>
  )
}
