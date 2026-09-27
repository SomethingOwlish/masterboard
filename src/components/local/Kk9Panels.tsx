// КК9 на планировании и разборе сессии (этап М4): живое состояние стола и
// отправка итогов. Состояние не сохраняется в кампанию — это то, что за
// столом КК9 сейчас, и держать его копию значило бы спорить с ним при слиянии.
import { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Select } from '../../ds'
import { KK9_STREAMS, KK9_STREAM_LABEL, TENSION_ZONE, kk9JournalPage, nextSessionText, type Kk9SessionResult, type Kk9State, type Kk9Stream } from '../../local/kk9'
import { withSession } from '../../local/labels'
import type { LocalCampaignRecord, LocalSessionPlanItem, LocalSessionRecord } from '../../local/types'
import { useExternal } from '../../local/useExternal'
import type { Persist } from './shared'

const day = (at: number) => at ? new Date(at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''

/** Состояние стола КК9 по связанной кампании: партия, журнал, заявки. Только чтение. */
export function Kk9StatePanel({ campaign, close }: { campaign: LocalCampaignRecord; close?: () => void }) {
  const port = useExternal()
  const link = campaign.integrations.kk9
  const [state, setState] = useState<Kk9State | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    if (!link) return
    setBusy(true); setError(null)
    port.kk9State(link.externalId).then((next) => setState(next), (failure: unknown) => setError(failure instanceof Error ? failure.message : 'КК9 не ответил')).finally(() => setBusy(false))
  }, [port, link])
  useEffect(() => { load() }, [load])

  return <aside className="plan-add-panel kk9-state" aria-label="Состояние КК9">
    <header><h2>КК9{link ? ` · ${link.label}` : ''}</h2><div className="row"><Button size="sm" icon="refresh-cw" disabled={busy || !link} onClick={load}>{busy ? 'Читаем…' : 'Обновить'}</Button>{close && <Button size="sm" icon="x" aria-label="Закрыть панель КК9" onClick={close} />}</div></header>
    {!link && <p className="muted">Кампания не связана с КК9. Связь ставит владелец в разделе «Публикация».</p>}
    {error && <p className="local-session-error" role="alert">{error}</p>}
    {state && <>
      <section aria-label="Стол КК9">
        <dl className="kk9-state__facts">
          <div><dt>Дата в игре</dt><dd>{state.campaign.gameDate || '—'}</dd></div>
          <div><dt>Погода</dt><dd>{state.campaign.weather || '—'}</dd></div>
          <div><dt>Следующая игра</dt><dd>{state.campaign.nextSession || 'не назначена'}</dd></div>
        </dl>
        {state.campaign.worldNote && <p className="muted">{state.campaign.worldNote}</p>}
      </section>
      <section aria-label="Партия КК9">
        <h3>Партия</h3>
        {state.party.length ? <div className="session-live-panel__list">{state.party.map((member) => <article key={member.id} aria-label={`Партия: ${member.name}`}>
          <div className="row"><strong>{member.name}</strong>{member.stunned && <Badge size="sm" tone="danger">Оглушён</Badge>}</div>
          <small className="mb-data">Тело {member.physical.damage}/{member.physical.max} · Разум {member.mental.damage}/{member.mental.max} · Энергия {member.energy.value}/{member.energy.max}</small>
          <small className="mb-data">Напряжение {member.tension.current}/{member.tension.max} — {TENSION_ZONE[member.tension.zone] ?? member.tension.zone}{member.tension.overcap ? ` · перегрузка ${member.tension.overcap}` : ''}</small>
          {member.statuses.length > 0 && <div className="row">{member.statuses.map((status, index) => <Badge key={`${status.name}-${index}`} size="sm" tone="neutral">{status.name}{status.term ? ` (${status.term})` : ''}</Badge>)}</div>}
        </article>)}</div> : <p className="muted">Партия в КК9 не собрана.</p>}
        <p className="muted">Урон — нанесённый, из максимума клеток; максимумы энергии и напряжения — без поправок статусов.</p>
      </section>
      <section aria-label="Заявки игроков КК9">
        <h3>Заявки игроков</h3>
        {state.requests.length ? <ul className="kk9-state__list">{state.requests.map((request) => <li key={request.id}><span className="panel-kicker">{request.kind} · {request.character}</span><strong>{request.name || 'без названия'}</strong>{request.description && <small>{request.description}</small>}</li>)}</ul> : <p className="muted">Открытых заявок нет.</p>}
      </section>
      <section aria-label="Журнал КК9">
        <h3>Журнал</h3>
        {state.journal.length ? <ul className="kk9-state__list">{state.journal.map((page) => <li key={`${page.stream}-${page.id}`}><span className="panel-kicker">{KK9_STREAM_LABEL[page.stream]}{page.at ? ` · ${day(page.at)}` : ''}</span><strong>{page.title || '(без заголовка)'}</strong>{page.body && <small>{page.body.length > 240 ? `${page.body.slice(0, 240)}…` : page.body}</small>}</li>)}</ul> : <p className="muted">Журнал пуст.</p>}
      </section>
    </>}
  </aside>
}

/**
 * Итоги разбора — в КК9: страница журнала (поток на выбор, по умолчанию
 * «Кампания») и дата следующей игры. Повтор переписывает ту же страницу; если
 * её поправили в КК9, мост отвечает конфликтом, и мастер решает (Р-4).
 */
export function Kk9SendPanel({ campaign, session, persist, itemTitle, canSend, hint }: {
  campaign: LocalCampaignRecord
  session: LocalSessionRecord
  persist: Persist
  itemTitle: (item: LocalSessionPlanItem) => string
  canSend: boolean
  hint?: string
}) {
  const port = useExternal()
  const link = campaign.integrations.kk9
  const [stream, setStream] = useState<Kk9Stream>(session.kk9Sent?.stream ?? 'campaign')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [clash, setClash] = useState<{ title: string; body: string; fingerprint?: number } | null>(null)
  if (!link) return null
  const page = kk9JournalPage(session, itemTitle)
  const next = session.nextGame ? nextSessionText(session.nextGame.date, session.nextGame.time) : ''

  const send = async (force = false) => {
    setBusy(true); setNote(null)
    try {
      const expected = session.kk9Sent && session.kk9Sent.stream === stream ? session.kk9Sent.fingerprint : undefined
      const result: Kk9SessionResult = await port.sendKk9Session(link.externalId, session.id, {
        journal: { stream, ...page, ...(expected !== undefined ? { expectedFingerprint: expected } : {}), ...(force ? { force: true } : {}) },
        ...(next ? { nextSession: next } : {}),
      })
      const lines: string[] = []
      let sent = session.kk9Sent
      if (result.journal?.ok && result.journal.id && result.journal.fingerprint !== undefined) {
        sent = { stream, pageId: result.journal.id, fingerprint: result.journal.fingerprint, sentAt: new Date().toISOString(), ...(sent?.nextSession ? { nextSession: sent.nextSession } : {}) }
        setClash(null)
        lines.push(`Журнал КК9 (${KK9_STREAM_LABEL[stream]}): записано.`)
      } else if (result.journal && !result.journal.ok) {
        if (result.journal.status === 409 && result.journal.current) setClash(result.journal.current)
        lines.push(`Журнал: ${result.journal.error}`)
      }
      if (result.nextSession?.ok) {
        sent = sent ? { ...sent, nextSession: next } : sent
        lines.push(`Следующая игра в КК9: ${next}.`)
      }
      if (sent !== session.kk9Sent) persist(withSession(campaign, { ...session, kk9Sent: sent }))
      setNote(lines.join(' '))
    } catch (failure) {
      setNote(failure instanceof Error ? failure.message : 'КК9 не ответил')
    } finally {
      setBusy(false)
    }
  }
  const keepTheirs = () => {
    // Оставить как в КК9: запомнить нынешнюю страницу своей, чтобы следующая отправка не спорила с ней.
    // Отпечаток приходит в 409, только если мост его отдаёт (контракт, `current.fingerprint`).
    const fingerprint = clash?.fingerprint
    if (fingerprint !== undefined && session.kk9Sent) {
      persist(withSession(campaign, { ...session, kk9Sent: { ...session.kk9Sent, stream, fingerprint } }))
      setNote('Страница в КК9 оставлена как есть. Следующая отправка перепишет её без вопроса.')
    } else {
      setNote('Страница в КК9 оставлена как есть. Следующая отправка снова спросит, что оставить.')
    }
    setClash(null)
  }

  return <section className="kk9-send" aria-label="Отправить в КК9">
    <h3>В КК9 · {link.label}</h3>
    <label>Поток журнала<Select aria-label="Поток журнала КК9" value={stream} onChange={(event) => setStream(event.target.value as Kk9Stream)}>{KK9_STREAMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
    <details><summary>Что уйдёт: «{page.title}»{next ? ` и следующая игра — ${next}` : ''}</summary><pre className="kk9-send__preview">{page.body || '(итогов пока нет — страница уйдёт с одним заголовком)'}</pre></details>
    {session.kk9Sent && <p className="muted">Отправлено {new Date(session.kk9Sent.sentAt).toLocaleString('ru-RU')} в «{KK9_STREAM_LABEL[session.kk9Sent.stream]}». Повтор перепишет ту же страницу.</p>}
    {clash ? <div className="kk9-send__clash" role="alert">
      <p>Страницу поправили в КК9 после прошлой отправки. Там сейчас:</p>
      <pre className="kk9-send__preview">{clash.title}{clash.body ? `\n\n${clash.body}` : ''}</pre>
      <div className="row"><Button variant="primary" disabled={busy || !canSend} onClick={() => void send(true)}>Перезаписать версией Masterboard</Button><Button disabled={busy} onClick={keepTheirs}>Оставить как в КК9</Button></div>
    </div> : <Button variant="primary" icon="upload" disabled={busy || !canSend} title={canSend ? undefined : hint} onClick={() => void send()}>{busy ? 'Отправляем…' : session.kk9Sent ? 'Отправить снова' : 'Отправить итоги в КК9'}</Button>}
    {!canSend && hint && <p className="muted" role="note">{hint}</p>}
    {note && <p role="status">{note}</p>}
  </section>
}
