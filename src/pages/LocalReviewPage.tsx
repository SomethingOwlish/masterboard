import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Icon } from '../ds'
import { localReviewDemo } from '../fixtures/localDemoRuntime'
import type { LocalReviewSnapshot, ReviewDecision } from '../fixtures/localReviewDemo'

const DECISIONS: Array<{ id: ReviewDecision; label: string; icon: string }> = [
  { id: 'resolved', label: 'Закрыто', icon: 'check' }, { id: 'unresolved', label: 'Не решено', icon: 'circle-help' },
  { id: 'carry-forward', label: 'В следующую сессию', icon: 'arrow-right' }, { id: 'task', label: 'Создать задачу', icon: 'list-checks' },
]

export function LocalReviewPage() {
  const demo = useMemo(() => localReviewDemo, [])
  const [review, setReview] = useState<LocalReviewSnapshot>(() => demo.read())
  const [notes, setNotes] = useState(review.notes)
  const [error, setError] = useState<string | null>(null)
  const decided = review.facts.filter((fact) => fact.decision).length
  const complete = () => { try { setReview(demo.saveNotes(notes)); setReview(demo.complete()); setError(null) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not complete review') } }

  return <main className="session-review-demo">
    <header className="session-review-demo__topbar"><Link to="/demo/conductor"><Icon name="arrow-left" size={15} /> Режим проведения</Link><div><Badge tone={review.completed ? 'success' : 'warning'} dot>{review.completed ? 'разбор завершён' : 'идёт разбор'}</Badge><Badge tone="neutral">Локальные тестовые данные</Badge></div></header>
    <section className="session-review-demo__hero"><div><span className="panel-kicker">После игры · Сессия 01</span><h1>Превратите игру в правду кампании</h1><p>Разберите каждый факт, пока он не потерялся в заметках.</p></div><div className="session-review-demo__meter"><strong>{decided}/{review.facts.length}</strong><span>решений принято</span><div><i style={{ width: `${decided / review.facts.length * 100}%` }} /></div></div></section>

    {error && <p className="local-session-error" role="alert">{error}</p>}
    <div className="session-review-demo__layout">
      <section className="session-review-demo__facts"><div className="panel-heading"><div><span className="panel-kicker">Выжимка фактического журнала</span><h2>Что изменилось?</h2></div><span className="panel-state">Одно решение для каждого факта</span></div>{review.facts.map((fact, index) => <article key={fact.id} className={fact.decision ? 'is-decided' : ''}><div className="session-review-demo__fact"><span>{String(index + 1).padStart(2, '0')}</span><div><Badge tone={fact.kind === 'secret' ? 'warning' : fact.kind === 'clock' ? 'accent' : 'neutral'} size="sm">{fact.kind}</Badge><h3>{fact.text}</h3></div></div><div className="session-review-demo__decisions">{DECISIONS.map((decision) => <button key={decision.id} disabled={review.completed} className={fact.decision === decision.id ? 'is-selected' : ''} onClick={() => { setReview(demo.decide(fact.id, decision.id)); setError(null) }}><Icon name={decision.icon} size={15} />{decision.label}</button>)}</div></article>)}</section>

      <aside className="session-review-demo__summary"><span className="panel-kicker">Пакет переноса</span><h2>Следующая сессия получит</h2><SummaryRow label="Открытые линии" count={review.facts.filter((fact) => fact.decision === 'unresolved').length} /><SummaryRow label="Подготовленный контекст" count={review.facts.filter((fact) => fact.decision === 'carry-forward').length} /><SummaryRow label="Задачи ведущего" count={review.facts.filter((fact) => fact.decision === 'task').length} /><label htmlFor="review-notes">Заметка разбора<textarea id="review-notes" name="review-notes" rows={5} value={notes} disabled={review.completed} placeholder="Что должен помнить будущий вы?" onChange={(event) => setNotes(event.target.value)} /></label>{review.completed ? <><div className="session-review-demo__sealed"><Icon name="shield" size={18} /><span><strong>Разбор закрыт</strong><small>Факты сессии готовы к переносу в кампанию.</small></span></div><Button icon="refresh-cw" onClick={() => setReview(demo.reopen())}>Открыть снова</Button><Link className="button-link primary" to="/demo/campaign">Вернуться в кампанию</Link></> : <Button variant="primary" icon="check" disabled={decided !== review.facts.length} onClick={complete}>Завершить разбор</Button>}</aside>
    </div>
    <p className="local-session-footnote">Только симуляция. Завершение разбора не создаёт внешних записей.</p>
  </main>
}

function SummaryRow({ label, count }: { label: string; count: number }) { return <div className="session-review-demo__summary-row"><span>{label}</span><strong>{count}</strong></div> }
