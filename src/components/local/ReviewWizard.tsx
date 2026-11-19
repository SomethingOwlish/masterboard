import { useState } from 'react'
import { Badge, Button, Select } from '../../ds'
import { applyReviewDraft, completeReview, missingDecisions, reviewDraftOf, reviewItems } from '../../local/sessionFlow'
import type { LocalCampaignRecord, LocalReviewChange, LocalReviewDecision, LocalReviewDraft, LocalSecretStatus, LocalSessionPlanItem, LocalSessionRecord } from '../../local/types'
import { withSession, clockReasonReady, LOG_KIND, REVIEW_DECISION, SECRET_STATUS, TIME_PLACEHOLDER } from '../../local/labels'
import { ClockReasonField } from './ClockReason'
import type { Persist } from './shared'
import { liveSessions, nextSessionNumber } from '../../local/sessions'
import { TableSendPanel } from './TablePanels'
import { LIVE_TABLE_LABEL, liveTable } from '../../local/table'

const STEPS = ['Итоги', 'Решения по пунктам', 'Последствия', 'Время в мире', 'Следующая сессия'] as const

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
  const drafts = liveSessions(campaign).filter((item) => item.id !== session.id && (item.status === 'draft' || item.status === 'ready'))
  const [target, setTarget] = useState<string>(() => drafts.some((item) => item.id === session.nextSessionId) ? session.nextSessionId! : 'new')
  const [error, setError] = useState<string | null>(null)
  const update = (next: LocalSessionRecord) => persist(withSession(campaign, next))
  const items = reviewItems(session)
  const missing = missingDecisions(session)
  const carried = items.filter((item) => session.reviewDecisions[item.id] === 'carry' && session.appliedDecisions[item.id] !== 'carry')
  // «Не создавать» нельзя, пока есть что переносить.
  const chosenTarget = carried.length && target === 'none' ? 'new' : target
  const nextSession = campaign.sessionRecords.find((item) => item.id === session.nextSessionId)
  const defaultReason = `Итоги сессии №${session.number}`
  const table = liveTable(campaign)

  if (session.reviewStatus === 'completed') {
    return <section className="session-review-panel" aria-label="Разбор сессии" tabIndex={-1}><header><div><span className="panel-kicker">Разбор завершён</span><h2>Итоги сессии №{session.number}</h2></div><Button disabled={!canComplete} title={canComplete ? undefined : completeHint} onClick={() => { update({ ...session, reviewStatus: 'draft' }); setStep(0) }}>Открыть разбор заново</Button></header>
      {session.reviewNotes && <p>{session.reviewNotes}</p>}
      <ul className="session-review-panel__summary">{items.map((item) => <li key={item.id}><strong>{itemTitle(item)}</strong> — {REVIEW_DECISION[session.reviewDecisions[item.id]]}</li>)}</ul>
      <AppliedChanges changes={session.reviewApplied} open />
      {nextSession && <Button variant="primary" onClick={() => openSession(nextSession.id)}>Открыть сессию №{nextSession.number}: {nextSession.title}</Button>}
      <TableSendPanel campaign={campaign} session={session} persist={persist} itemTitle={itemTitle} canSend={canComplete} hint={completeHint} />
    </section>
  }

  const finish = () => {
    try {
      setError(null)
      const next = completeReview(campaign, session.id, { target: chosenTarget, now: new Date().toISOString() })
      persist(next)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Не удалось завершить разбор')
    }
  }
  // Steps 3–4 write only to the draft; «Завершить разбор» applies it (ТЗ-3, этап 12).
  const draft = reviewDraftOf(session)
  const setDraft = (next: LocalReviewDraft) => update({ ...session, reviewDraft: next })
  const reasonOf = (clockId: string) => reasons[clockId] ?? draft.clocks[clockId]?.reason ?? ''
  const moveReviewClock = (clockId: string, step: -1 | 1) => {
    const clock = campaign.clocks.find((item) => item.id === clockId)
    const reason = reasonOf(clockId).trim()
    if (!clock || !clockReasonReady(reason)) return
    const delta = (draft.clocks[clockId]?.delta ?? 0) + step
    if (clock.value + delta < 0 || clock.value + delta > clock.segments) return
    const { [clockId]: _dropped, ...rest } = draft.clocks
    setDraft({ ...draft, clocks: delta ? { ...rest, [clockId]: { delta, reason } } : rest })
  }
  const setArc = (arcId: string, progress: number) => {
    const arc = campaign.storyArcs.find((item) => item.id === arcId)
    const { [arcId]: _dropped, ...rest } = draft.arcs
    setDraft({ ...draft, arcs: arc && arc.progress === progress ? rest : { ...rest, [arcId]: progress } })
  }
  const setSecret = (secretId: string, status: LocalSecretStatus) => {
    const secret = campaign.secrets.find((item) => item.id === secretId)
    const { [secretId]: _dropped, ...rest } = draft.secrets
    setDraft({ ...draft, secrets: secret && secret.status === status ? rest : { ...rest, [secretId]: status } })
  }
  const planSecretIds = new Set(session.planItems.flatMap((item) => item.secretId ? [item.secretId] : []))
  const secrets = [...campaign.secrets].sort((a, b) => Number(planSecretIds.has(b.id)) - Number(planSecretIds.has(a.id)))
  const pendingChanges = applyReviewDraft(campaign, session, '').changes
  const reviewArcs = campaign.storyArcs.filter((arc) => arc.status === 'active' || arc.id === session.arcId)
  const canNext = step !== 1 || missing.length === 0

  return <section className="session-review-panel session-review-wizard" aria-label="Разбор сессии" tabIndex={-1}>
    <header><div><span className="panel-kicker">Разбор сессии №{session.number} · шаг {step + 1} из {STEPS.length}</span><h2>{STEPS[step]}</h2></div></header>
    <ol className="session-review-wizard__steps">{STEPS.map((label, index) => <li key={label} className={index === step ? 'active' : index < step ? 'done' : ''}><button onClick={() => setStep(index)} disabled={index > 1 && missing.length > 0} aria-current={index === step ? 'step' : undefined}>{index + 1}. {label}</button></li>)}</ol>

    {step === 0 && <div className="session-review-wizard__body">
      {session.log.length ? <ol className="session-live-panel__log">{session.log.map((entry) => <li key={entry.id}><time>{new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time><div><Badge size="sm" tone={entry.kind === 'moment' ? 'neutral' : 'accent'}>{LOG_KIND[entry.kind]}</Badge><span>{entry.text}</span></div></li>)}</ol> : <p className="muted">Журнал сессии пуст.</p>}
      <label htmlFor="review-notes">Итоги сессии<textarea id="review-notes" rows={4} value={session.reviewNotes} placeholder="Что изменилось в истории и у героев" onChange={(e) => update({ ...session, reviewNotes: e.target.value })} /></label>
    </div>}

    {step === 1 && <div className="session-review-wizard__body">
      {items.length ? <div className="session-review-panel__unused">{items.map((item) => <label key={item.id}><span><strong>{itemTitle(item)}</strong><small>{item.priority === 'required' ? 'Обязательно' : 'Желательно'}{session.appliedDecisions[item.id] ? ' · уже применено' : ''}</small></span><Select aria-label={`Решение: ${itemTitle(item)}`} value={session.reviewDecisions[item.id] ?? ''} onChange={(e) => update({ ...session, reviewDecisions: { ...session.reviewDecisions, [item.id]: e.target.value as LocalReviewDecision } })}><option value="">Нужно решение</option>{Object.entries(REVIEW_DECISION).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>)}</div> : <p className="muted">Все обязательные и желательные пункты сыграны. Решений не требуется.</p>}
      {missing.length > 0 && <p className="local-session-error">Осталось решить: {missing.length}.</p>}
    </div>}

    {step === 2 && <div className="session-review-wizard__body">
      <p className="session-plan__notice">Изменения копятся черновиком и применятся по «Завершить разбор». До этого часы, линии и секреты в кампании не меняются.</p>
      <AppliedChanges changes={session.reviewApplied} />
      <h3>Часы</h3>
      {campaign.clocks.length ? <div className="session-live-panel__list">{campaign.clocks.map((clock) => {
        const delta = draft.clocks[clock.id]?.delta ?? 0
        const value = clock.value + delta
        return <article key={clock.id} aria-label={`Часы: ${clock.title}`}>
          <div className="row">
            <strong>{clock.title}</strong>
            <span className="mb-data">{delta ? `${clock.value}/${clock.segments} → ${value}/${clock.segments}` : `${clock.value}/${clock.segments}`}</span>
          </div>
          <ClockReasonField
            title={clock.title}
            value={reasonOf(clock.id)}
            extra={[defaultReason]}
            onChange={(reason) => setReasons({ ...reasons, [clock.id]: reason })}
          />
          <div className="row">
            <Button
              size="sm"
              aria-label={`Откатить ${clock.title}`}
              disabled={value <= 0 || !clockReasonReady(reasonOf(clock.id))}
              onClick={() => moveReviewClock(clock.id, -1)}
            >
              −1
            </Button>
            <Button
              size="sm"
              variant="primary"
              aria-label={`Продвинуть ${clock.title}`}
              disabled={value >= clock.segments || !clockReasonReady(reasonOf(clock.id))}
              onClick={() => moveReviewClock(clock.id, 1)}
            >
              +1
            </Button>
          </div>
        </article>
      })}</div> : <p className="muted">Часов нет.</p>}
      <h3>Сюжетные линии</h3>
      {!reviewArcs.length && <p className="muted">Активных линий нет.</p>}
      {reviewArcs.map((arc) => {
        const progress = draft.arcs[arc.id] ?? arc.progress
        return <label
          key={arc.id}
          className="session-review-wizard__arc"
        >
          {arc.title} · {progress !== arc.progress ? `${arc.progress}% → ${progress}%` : `${progress}%`}
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            aria-label={`Прогресс линии: ${arc.title}`}
            value={progress}
            onChange={(e) => setArc(arc.id, Number(e.target.value))}
          />
        </label>
      })}
      <h3>Секреты</h3>
      {secrets.length ? <div className="session-live-panel__list">{secrets.map((secret) => {
        const status = draft.secrets[secret.id] ?? secret.status
        return <article key={secret.id}>
          <div className="row">
            <strong>{secret.title}</strong>
            {planSecretIds.has(secret.id) && <Badge size="sm" tone="accent">В плане</Badge>}
          </div>
          {status !== secret.status && <small>Было: {SECRET_STATUS[secret.status]}</small>}
          <Select
            aria-label={`Состояние секрета: ${secret.title}`}
            value={status}
            onChange={(e) => setSecret(secret.id, e.target.value as LocalSecretStatus)}
          >
            {Object.entries(SECRET_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </article>
      })}</div> : <p className="muted">Секретов нет.</p>}
    </div>}

    {step === 3 && <div className="session-review-wizard__body">
      <label htmlFor="review-time">
        Текущее время кампании после сессии
        <input
          id="review-time"
          value={draft.time ?? campaign.activeTime}
          placeholder={TIME_PLACEHOLDER}
          onChange={(e) => setDraft({ ...draft, time: e.target.value })}
        />
      </label>
      {draft.time !== undefined && draft.time.trim() !== campaign.activeTime && <small className="muted">Сейчас: {campaign.activeTime || 'не задано'}. Новое время применится по «Завершить разбор».</small>}
    </div>}

    {step === 4 && <div className="session-review-wizard__body">
      <fieldset className="session-review-wizard__next-game"><legend>Когда следующая игра</legend>
        <div className="row"><input type="date" aria-label="Дата следующей игры" value={session.nextGame?.date ?? ''} onChange={(e) => update({ ...session, nextGame: { date: e.target.value, time: session.nextGame?.time ?? '' } })} /><input aria-label="Время следующей игры" value={session.nextGame?.time ?? ''} placeholder="19:00" onChange={(e) => update({ ...session, nextGame: { date: session.nextGame?.date ?? '', time: e.target.value } })} /></div>
        <small className="muted">
          Дата ляжет в выбранную ниже сессию, если у неё ещё нет своей.
          {table ? ` Итоги и дату в ${LIVE_TABLE_LABEL[table.system]} можно отправить после завершения разбора.` : ''}
        </small>
      </fieldset>
      {carried.length > 0 && <p>Переносятся пункты: {carried.map(itemTitle).join(', ')}.</p>}
      {pendingChanges.length > 0 && <div className="session-review-wizard__pending">
        <p>Применится по «Завершить разбор»:</p>
        <ChangeList changes={pendingChanges} />
      </div>}
      <label htmlFor="review-target">
        {carried.length ? 'Куда перенести' : 'Следующая сессия'}
        <select id="review-target" value={chosenTarget} onChange={(e) => setTarget(e.target.value)}>
          <option value="new">Новая сессия №{nextSessionNumber(campaign)}</option>
          {drafts.map((item) => <option key={item.id} value={item.id}>№{item.number} {item.title}</option>)}
          {!carried.length && <option value="none">Пока не создавать</option>}
        </select>
      </label>
      {error && <p className="local-session-error">{error}</p>}
      <Button variant="primary" icon="check" disabled={missing.length > 0 || !canComplete} onClick={finish}>Завершить разбор</Button>{!canComplete && <p className="muted" role="note">{completeHint}</p>}
    </div>}

    <footer className="session-review-wizard__nav"><Button disabled={step === 0} onClick={() => setStep(step - 1)}>Назад</Button>{step < STEPS.length - 1 && <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Далее</Button>}</footer>
  </section>
}


const CHANGE_KIND: Record<LocalReviewChange['kind'], string> = { clock: 'Часы', arc: 'Линия', time: 'Время', secret: 'Секрет' }

function ChangeList({ changes }: { changes: LocalReviewChange[] }) {
  return <ul className="session-review-wizard__changes">
    {changes.map((change, index) => <li key={`${change.kind}-${change.title}-${index}`}>
      <Badge size="sm" tone="neutral">{CHANGE_KIND[change.kind]}</Badge>
      {' '}
      <strong>{change.title}</strong>
      {`: ${change.from} → ${change.to}`}
    </li>)}
  </ul>
}

/** What earlier completions of this review applied. */
function AppliedChanges({ changes, open = false }: { changes?: LocalReviewChange[]; open?: boolean }) {
  if (!changes?.length) return null
  return <details
    className="session-review-wizard__applied"
    open={open}
  >
    <summary>Уже применено · {changes.length}</summary>
    <ChangeList changes={changes} />
  </details>
}
