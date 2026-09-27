import { useState } from 'react'
import { Badge, Button, Select } from '../../ds'
import { moveClock } from '../../local/domain'
import { LOG_KIND, completeReview, missingDecisions, reviewItems } from '../../local/sessionFlow'
import type { LocalCampaignRecord, LocalReviewDecision, LocalSessionPlanItem, LocalSessionRecord } from '../../local/types'
import { withSession } from '../../local/labels'
import type { Persist } from './shared'
import { liveSessions, nextSessionNumber } from '../../local/sessions'
import { Kk9SendPanel } from './Kk9Panels'

const STEPS = ['Итоги', 'Решения по пунктам', 'Последствия', 'Время в мире', 'Следующая сессия'] as const
const DECISION: Record<LocalReviewDecision, string> = { carry: 'Перенести в следующую', library: 'Вернуть только в библиотеку', cancel: 'Отменить', keep: 'Оставить неиспользованным' }

interface Props {
  campaign: LocalCampaignRecord
  session: LocalSessionRecord
  persist: Persist
  itemTitle: (item: LocalSessionPlanItem) => string
  openSession: (id: string) => void
  canComplete?: boolean
  completeHint?: string
}

/** Step-by-step close of a played session: summary, decisions, consequences, world time, next session. */
export function ReviewWizard({ campaign, session, persist, itemTitle, openSession, canComplete = true, completeHint }: Props) {
  const [step, setStep] = useState(0)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [target, setTarget] = useState<string>('new')
  const [error, setError] = useState<string | null>(null)
  const update = (next: LocalSessionRecord) => persist(withSession(campaign, next))
  const items = reviewItems(session)
  const missing = missingDecisions(session)
  const carried = items.filter((item) => session.reviewDecisions[item.id] === 'carry' && session.appliedDecisions[item.id] !== 'carry')
  const drafts = liveSessions(campaign).filter((item) => item.id !== session.id && (item.status === 'draft' || item.status === 'ready'))
  const nextSession = campaign.sessionRecords.find((item) => item.id === session.nextSessionId)
  const defaultReason = `Итоги сессии №${session.number}`

  if (session.reviewStatus === 'completed') {
    return <section className="session-review-panel" aria-label="Разбор сессии"><header><div><span className="panel-kicker">Разбор завершён</span><h2>Итоги сессии №{session.number}</h2></div><Button disabled={!canComplete} title={canComplete ? undefined : completeHint} onClick={() => { update({ ...session, reviewStatus: 'draft' }); setStep(0) }}>Открыть разбор заново</Button></header>
      {session.reviewNotes && <p>{session.reviewNotes}</p>}
      <ul className="session-review-panel__summary">{items.map((item) => <li key={item.id}><strong>{itemTitle(item)}</strong> — {DECISION[session.reviewDecisions[item.id]]}</li>)}</ul>
      {nextSession && <Button variant="primary" onClick={() => openSession(nextSession.id)}>Открыть сессию №{nextSession.number}: {nextSession.title}</Button>}
      <Kk9SendPanel campaign={campaign} session={session} persist={persist} itemTitle={itemTitle} canSend={canComplete} hint={completeHint} />
    </section>
  }

  const finish = () => {
    try {
      setError(null)
      const next = completeReview(campaign, session.id, { target, now: new Date().toISOString() })
      persist(next)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Не удалось завершить разбор')
    }
  }
  const moveReviewClock = (clockId: string, delta: number) => {
    const clock = campaign.clocks.find((item) => item.id === clockId)
    const result = clock && moveClock(clock, delta, reasons[clockId]?.trim() || defaultReason, new Date().toISOString())
    if (result) persist({ ...campaign, clocks: campaign.clocks.map((item) => item.id === clockId ? result.clock : item) })
  }
  const canNext = step !== 1 || missing.length === 0

  return <section className="session-review-panel session-review-wizard" aria-label="Разбор сессии">
    <header><div><span className="panel-kicker">Разбор сессии №{session.number} · шаг {step + 1} из {STEPS.length}</span><h2>{STEPS[step]}</h2></div></header>
    <ol className="session-review-wizard__steps">{STEPS.map((label, index) => <li key={label} className={index === step ? 'active' : index < step ? 'done' : ''}><button onClick={() => setStep(index)} disabled={index > 1 && missing.length > 0} aria-current={index === step ? 'step' : undefined}>{index + 1}. {label}</button></li>)}</ol>

    {step === 0 && <div className="session-review-wizard__body">
      {session.log.length ? <ol className="session-live-panel__log">{session.log.map((entry) => <li key={entry.id}><time>{new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time><div><Badge size="sm" tone={entry.kind === 'moment' ? 'neutral' : 'accent'}>{LOG_KIND[entry.kind]}</Badge><span>{entry.text}</span></div></li>)}</ol> : <p className="muted">Журнал сессии пуст.</p>}
      <label htmlFor="review-notes">Итоги сессии<textarea id="review-notes" rows={4} value={session.reviewNotes} placeholder="Что изменилось в истории и у героев" onChange={(e) => update({ ...session, reviewNotes: e.target.value })} /></label>
    </div>}

    {step === 1 && <div className="session-review-wizard__body">
      {items.length ? <div className="session-review-panel__unused">{items.map((item) => <label key={item.id}><span><strong>{itemTitle(item)}</strong><small>{item.priority === 'required' ? 'Обязательно' : 'Желательно'}{session.appliedDecisions[item.id] ? ' · уже применено' : ''}</small></span><Select aria-label={`Решение: ${itemTitle(item)}`} value={session.reviewDecisions[item.id] ?? ''} onChange={(e) => update({ ...session, reviewDecisions: { ...session.reviewDecisions, [item.id]: e.target.value as LocalReviewDecision } })}><option value="">Нужно решение</option>{Object.entries(DECISION).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>)}</div> : <p className="muted">Все обязательные и желательные пункты сыграны. Решений не требуется.</p>}
      {missing.length > 0 && <p className="local-session-error">Осталось решить: {missing.length}.</p>}
    </div>}

    {step === 2 && <div className="session-review-wizard__body">
      <h3>Часы</h3>
      {campaign.clocks.length ? <div className="session-live-panel__list">{campaign.clocks.map((clock) => <article key={clock.id}><div className="row"><strong>{clock.title}</strong><span className="mb-data">{clock.value}/{clock.segments}</span></div><div className="row"><input aria-label={`Причина: ${clock.title}`} value={reasons[clock.id] ?? ''} placeholder={defaultReason} onChange={(e) => setReasons({ ...reasons, [clock.id]: e.target.value })} /><Button size="sm" aria-label={`Откатить ${clock.title}`} disabled={!clock.value} onClick={() => moveReviewClock(clock.id, -1)}>−1</Button><Button size="sm" variant="primary" aria-label={`Продвинуть ${clock.title}`} disabled={clock.value === clock.segments} onClick={() => moveReviewClock(clock.id, 1)}>+1</Button></div></article>)}</div> : <p className="muted">Часов нет.</p>}
      <h3>Сюжетные линии</h3>
      {campaign.storyArcs.filter((arc) => arc.status === 'active' || arc.id === session.arcId).map((arc) => <label key={arc.id} className="session-review-wizard__arc">{arc.title} · {arc.progress}%<input type="range" min="0" max="100" step="10" aria-label={`Прогресс линии: ${arc.title}`} value={arc.progress} onChange={(e) => persist({ ...campaign, storyArcs: campaign.storyArcs.map((item) => item.id === arc.id ? { ...item, progress: Number(e.target.value) } : item) })} /></label>)}
      <p className="muted">Раскрытия секретов записываются в «Пульте» или в живой панели во время игры.</p>
    </div>}

    {step === 3 && <div className="session-review-wizard__body">
      <label htmlFor="review-time">Текущее время кампании после сессии<input id="review-time" value={campaign.activeTime} onChange={(e) => persist({ ...campaign, activeTime: e.target.value })} /></label>
    </div>}

    {step === 4 && <div className="session-review-wizard__body">
      <fieldset className="session-review-wizard__next-game"><legend>Когда следующая игра</legend>
        <div className="row"><input type="date" aria-label="Дата следующей игры" value={session.nextGame?.date ?? ''} onChange={(e) => update({ ...session, nextGame: { date: e.target.value, time: session.nextGame?.time ?? '' } })} /><input aria-label="Время следующей игры" value={session.nextGame?.time ?? ''} placeholder="19:00" onChange={(e) => update({ ...session, nextGame: { date: session.nextGame?.date ?? '', time: e.target.value } })} /></div>
        <small className="muted">Дата ляжет в следующую сессию{campaign.integrations.kk9 ? ' и уйдёт в КК9 вместе с итогами' : ''}.</small>
      </fieldset>
      {carried.length ? <>
        <p>Переносятся пункты: {carried.map(itemTitle).join(', ')}.</p>
        <label htmlFor="review-target">Куда перенести<select id="review-target" value={target} onChange={(e) => setTarget(e.target.value)}><option value="new">Новая сессия №{nextSessionNumber(campaign)}</option>{drafts.map((item) => <option key={item.id} value={item.id}>№{item.number} {item.title}</option>)}</select></label>
      </> : <p className="muted">Переносить нечего.</p>}
      {error && <p className="local-session-error">{error}</p>}
      <Button variant="primary" icon="check" disabled={missing.length > 0 || !canComplete} onClick={finish}>Завершить разбор</Button>{!canComplete && <p className="muted" role="note">{completeHint}</p>}
    </div>}

    <footer className="session-review-wizard__nav"><Button disabled={step === 0} onClick={() => setStep(step - 1)}>Назад</Button>{step < STEPS.length - 1 && <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Далее</Button>}</footer>
  </section>
}
