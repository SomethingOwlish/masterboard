import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Icon, Select } from '../ds'
import { localSessionDemo } from '../fixtures/localDemoRuntime'
import type { DocumentSnapshot } from '../storage/gateway'
import type { SessionLogEntry, SessionStatus, TargetSessionDocument } from '../storage/sessionDocuments'

const STATUS_LABEL: Record<SessionStatus, string> = {
  draft: 'Черновик', prepared: 'Готова', running: 'Идёт игра', closed: 'Закрыта',
  review: 'Идёт разбор', 'review-complete': 'Разбор завершён',
}

function now() {
  return new Date().toISOString()
}

export function LocalSessionDemoPage() {
  const demo = useMemo(() => localSessionDemo, [])
  const [session, setSession] = useState<DocumentSnapshot<TargetSessionDocument> | null>(null)
  const [objective, setObjective] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [entryText, setEntryText] = useState('')
  const [entryKind, setEntryKind] = useState<SessionLogEntry['kind']>('note')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const adopt = (next: DocumentSnapshot<TargetSessionDocument>) => {
    setSession(next)
    setObjective(String(next.data.plan.objective ?? ''))
    setReviewNotes(next.data.review.notes)
  }

  useEffect(() => {
    void demo.ensureSession().then(adopt).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load demo'))
  }, [demo])

  const run = async (work: () => Promise<DocumentSnapshot<TargetSessionDocument>>) => {
    setBusy(true)
    setError(null)
    try {
      adopt(await work())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (!session) return <main className="local-session-shell"><p className="muted">Загружаем локальную сессию…</p></main>

  const { data } = session
  const masterId = data.responsibleMasterId
  const lifecycleInput = { campaignId: demo.campaignId, sessionId: demo.sessionId, masterId, now: now() }

  const transition = (to: 'draft' | 'prepared' | 'running' | 'closed') =>
    run(() => demo.lifecycle.transition({ ...lifecycleInput, to }))

  const savePlan = () => run(() => demo.lifecycle.updatePlan({
    ...lifecycleInput, plan: { ...data.plan, objective: objective.trim() },
  }))

  const appendEntry = () => {
    const text = entryText.trim()
    if (!text) return
    void run(() => demo.lifecycle.appendLiveEntry({
      ...lifecycleInput,
      entry: { id: crypto.randomUUID(), at: lifecycleInput.now, kind: entryKind, text, source: 'during-session' },
    })).then(() => setEntryText(''))
  }

  const startReview = () => run(() => demo.lifecycle.updateReview({
    ...lifecycleInput, review: { notes: reviewNotes.trim() },
  }))

  return (
    <main className="local-session-shell">
      <header className="local-session-topbar">
        <Link to="/demo/campaign" className="row muted" style={{ textDecoration: 'none' }}><Icon name="arrow-left" size={16} /> Панель кампании</Link>
        <Badge tone="neutral" dot>Локальные тестовые данные</Badge>
      </header>

      <div className="local-session-board-link"><span><strong>План сессии готов?</strong><small>Расставьте сцены и связанные объекты перед игрой.</small></span><Link to="/demo/session-board">Открыть доску сцен <Icon name="arrow-right" size={15} /></Link></div>

      <section className="local-session-hero">
        <div>
          <span className="panel-kicker">Лунный порт · тестовый сценарий</span><h1>Первая ночь в Лунном порту</h1><p>Проведите полную сессию без учётных данных, сети и внешних сервисов.</p>
        </div>
        <div className="local-session-status">
          <span>Текущий этап</span>
          <strong>{STATUS_LABEL[data.status]}</strong>
          <small>Ответственный: {masterId === demo.ownerId ? 'Сова' : 'Лис'}</small>
        </div>
      </section>

      {error && <p className="local-session-error" role="alert">{error}</p>}

      <div className="local-session-grid">
        <section className="card local-session-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">До игры</span><h2 className="section-title">План сессии</h2></div>
            <Badge tone={data.status === 'draft' ? 'warning' : 'success'}>{STATUS_LABEL[data.status]}</Badge>
          </div>
          <label className="field" htmlFor="demo-objective">
            <span>Цель</span>
            <textarea id="demo-objective" name="demo-objective" rows={5} value={objective} disabled={!['draft', 'prepared', 'running'].includes(data.status)} onChange={(event) => setObjective(event.target.value)} />
          </label>
          <div className="row local-session-actions">
            {['draft', 'prepared', 'running'].includes(data.status) && <Button onClick={() => void savePlan()} disabled={busy}>Сохранить план</Button>}
            {data.status === 'draft' && <Button variant="primary" icon="check" onClick={() => void transition('prepared')} disabled={busy}>Отметить готовой</Button>}
            {data.status === 'prepared' && <Button variant="ghost" onClick={() => void transition('draft')} disabled={busy}>Back to draft</Button>}
            {data.status === 'prepared' && <Button variant="primary" icon="clapperboard" onClick={() => void transition('running')} disabled={busy}>Начать сессию</Button>}
            {data.status === 'running' && <Button variant="primary" onClick={() => void transition('closed')} disabled={busy}>Завершить сессию</Button>}
          </div>
          {['draft', 'prepared', 'running'].includes(data.status) && (
            <Button
              variant="ghost"
              size="sm"
              icon="arrow-left-right"
              disabled={busy}
              onClick={() => void run(() => demo.lifecycle.transferResponsibility({
                ...lifecycleInput, nextMasterId: masterId === demo.ownerId ? demo.coMasterId : demo.ownerId,
              }))}
            >
              Hand over to {masterId === demo.ownerId ? 'Fox' : 'Owl'}
            </Button>
          )}
        </section>

        <section className="card local-session-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">За столом</span><h2 className="section-title">Фактический журнал</h2></div>
            <span className="panel-state">{data.actualLog.length} entries</span>
          </div>
          {data.status === 'running' && (
            <div className="local-log-composer">
              <Select aria-label="Entry kind" value={entryKind} onChange={(event) => setEntryKind(event.target.value as SessionLogEntry['kind'])}>
                {['note', 'scene', 'event', 'clock', 'secret', 'consequence', 'task', 'material'].map((kind) => <option key={kind}>{kind}</option>)}
              </Select>
              <input id="demo-log-entry" name="demo-log-entry" value={entryText} placeholder="What happened at the table?" onChange={(event) => setEntryText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') appendEntry() }} />
              <Button variant="primary" icon="plus" onClick={appendEntry} disabled={busy || !entryText.trim()}>Add</Button>
            </div>
          )}
          {data.actualLog.length === 0 ? <p className="muted">The factual log opens when the session starts.</p> : (
            <ol className="local-log-list">
              {data.actualLog.map((entry) => <li key={entry.id}><Badge tone="neutral">{entry.kind}</Badge><span>{entry.text}</span><time>{entry.at.slice(11, 16)}</time></li>)}
            </ol>
          )}
          {data.status !== 'running' && data.status !== 'draft' && data.status !== 'prepared' && <p className="muted local-session-lock"><Icon name="shield" size={15} /> Factual log is locked after play.</p>}
        </section>

        <section className="card local-session-panel local-session-review">
          <div className="panel-heading"><div><span className="panel-kicker">After play</span><h2 className="section-title">Review and carry-forward</h2></div></div>
          <label className="field" htmlFor="demo-review">
            <span>Review notes</span>
            <textarea id="demo-review" name="demo-review" rows={4} value={reviewNotes} disabled={!['closed', 'review'].includes(data.status)} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Consequences, unresolved threads, preparation for next time…" />
          </label>
          <div className="row local-session-actions">
            {data.status === 'closed' && <Button variant="primary" onClick={() => void startReview()} disabled={busy}>Begin review</Button>}
            {data.status === 'review' && <Button onClick={() => void startReview()} disabled={busy}>Save review</Button>}
            {data.status === 'review' && <Button variant="primary" icon="check" onClick={() => void run(() => demo.lifecycle.completeReview(lifecycleInput))} disabled={busy}>Complete review</Button>}
            {data.status === 'review-complete' && <Button icon="refresh-cw" onClick={() => void run(() => demo.lifecycle.reopenReview(lifecycleInput))} disabled={busy}>Reopen review</Button>}
          </div>
          {!['closed', 'review', 'review-complete'].includes(data.status) && <p className="muted">Available after the session is closed.</p>}
        </section>
      </div>

      <p className="local-session-footnote">Перезагрузка сбросит изолированное пространство. Все данные тестовые и остаются в памяти.</p>
    </main>
  )
}
