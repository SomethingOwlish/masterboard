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

  if (!snapshot) return <main className="target-dashboard"><p className="muted">Загружаем Лунный порт…</p></main>
  const { session, lines, clocks, secrets, tasks, inbox } = snapshot

  return (
    <main className="target-dashboard">
      <header className="target-dashboard__topbar">
        <div className="row target-demo-links"><Link to="/" className="row muted"><Icon name="arrow-left" size={16} /> Кампании</Link><Link to="/demo/library" className="row muted"><Icon name="library" size={16} /> Библиотека</Link><Link to="/demo/publications" className="row muted"><Icon name="upload" size={16} /> Публикации</Link></div>
        <div className="row"><Badge tone="neutral" dot>Локальные тестовые данные</Badge><span className="target-dashboard__master">Сова + Лис</span></div>
      </header>

      <section className="target-dashboard__hero">
        <div>
          <span className="panel-kicker">Панель кампании</span><h1>Лунный порт</h1><p>Город в гавани заключает сделки с красной луной.</p>
        </div>
        <div className="target-dashboard__time"><span>Текущее время</span><strong>Третья ночь Фестиваля фонарей</strong></div>
      </section>
      {error && <p className="local-session-error" role="alert">{error}</p>}

      <section className="target-dashboard__session">
        <div>
          <span className="panel-kicker">Текущая сессия</span><h2>{session ? 'Первая ночь в Лунном порту' : 'Сессия не выбрана'}</h2><p>Открыть восточные ворота и представить Серебряного Лиса.</p>
        </div>
        <div className="target-dashboard__session-action">
          <Badge tone="warning" dot>{session?.status ?? 'none'}</Badge>
          <Link to="/demo/session" className="button-link primary"><Icon name="clapperboard" size={16} /> Открыть сессию</Link>
        </div>
      </section>

      <div className="target-dashboard__grid">
        <Card className="target-panel target-panel--wide">
          <div className="panel-heading"><div><span className="panel-kicker">Движение кампании</span><h2 className="section-title">Активные линии</h2></div><span className="panel-state">{lines.length} активна</span></div>
          <div className="target-lines">
            {lines.map((line) => <article key={line.title}><div><Badge tone="accent" size="sm">{line.state}</Badge><h3>{line.title}</h3><p>{line.direction}</p></div><strong>{line.stakes}</strong></article>)}
          </div>
        </Card>

        <Card className="target-panel">
          <div className="panel-heading"><div><span className="panel-kicker">Давление</span><h2 className="section-title">Часы</h2></div></div>
          {clocks.map((clock) => <div className="target-clock" key={clock.title}><div className="row"><strong>{clock.title}</strong><span className="mb-data">{clock.value}/{clock.max}</span></div><div className="target-clock__track"><span style={{ width: `${(clock.value / clock.max) * 100}%` }} /></div><small>{clock.visibleToPlayers ? 'Видно игрокам' : 'Только ведущим'}</small></div>)}
        </Card>

        <Card className="target-panel">
          <div className="panel-heading"><div><span className="panel-kicker">Знание</span><h2 className="section-title">Секреты</h2></div><span className="panel-state">{secrets.length} скрыт</span></div>
          {secrets.map((secret) => <article className="target-secret" key={secret.title}><Badge tone="warning" icon="shield" size="sm">{secret.state}</Badge><h3>{secret.title}</h3><p>{secret.truth}</p><small>Раскрыть, когда: {secret.revealConditions.join(', ')}</small></article>)}
        </Card>

        <Card className="target-panel">
          <div className="panel-heading"><div><span className="panel-kicker">Личное</span><h2 className="section-title">Список ведущего</h2></div><span className="panel-state">{tasks.filter((task) => task.state !== 'done').length} открыто</span></div>
          <ul className="target-checklist">
            {tasks.sort((a, b) => a.order - b.order).map((task) => <li key={task.id}><input id={`task-${task.id}`} type="checkbox" checked={task.state === 'done'} disabled={busy} onChange={() => void act(() => demo.toggleTask(task.id))} /><label htmlFor={`task-${task.id}`}>{task.title}</label><Badge tone={task.state === 'doing' ? 'accent' : 'neutral'} size="sm">{task.state}</Badge></li>)}
          </ul>
        </Card>

        <Card className="target-panel">
          <div className="panel-heading"><div><span className="panel-kicker">Быстрая запись</span><h2 className="section-title">Входящие</h2></div><span className="panel-state">{inbox.length}</span></div>
          <div className="target-capture"><input id="dashboard-capture" name="dashboard-capture" value={capture} placeholder="Запишите идею, не разбирая её…" onChange={(event) => setCapture(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addCapture() }} /><Button variant="primary" icon="plus" disabled={busy || !capture.trim()} onClick={addCapture}>Записать</Button></div>
          <ol className="target-inbox">{[...inbox].sort((a, b) => a.order - b.order).map((item) => <li key={item.id}><span>{item.text}</span><Badge tone="neutral" size="sm">{item.targetType}</Badge></li>)}</ol>
        </Card>
      </div>

      <p className="local-session-footnote">Кампания работает на локальных тестовых данных. Перезагрузка сбросит изменения.</p>
    </main>
  )
}
