// Живой стол на планировании и разборе сессии: КК9 (этап М4) и Ноктюрн
// (решения 3 октября 2026) одной панелью состояния и своей отправкой итогов.
// Состояние не сохраняется в кампанию — это то, что за столом сейчас, и
// держать его копию значило бы спорить с ним при слиянии.
import { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Select } from '../../ds'
import { KK9_STREAMS, KK9_STREAM_LABEL, kk9JournalPage, nextSessionText, type Kk9SessionResult, type Kk9Stream } from '../../local/kk9'
import { NOCTURNE_STREAMS, NOCTURNE_STREAM_LABEL, TENSION_LABELS, nocturneDateText, nocturneNextSession, nocturnePosts, type NocturneDistrictChange, type NocturneSessionBody, type NocturneState, type NocturneStream } from '../../local/nocturne'
import { LIVE_TABLE_LABEL, LIVE_TABLE_OF, kk9View, liveTable, nocturneView, notableDistrict, type TableView } from '../../local/table'
import { withSession } from '../../local/labels'
import type { LocalCampaignRecord, LocalSessionPlanItem, LocalSessionRecord } from '../../local/types'
import { useExternal } from '../../local/useExternal'
import type { Persist } from './shared'

const day = (at: number) => at ? new Date(at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''

/** Состояние связанного стола (КК9 или Ноктюрн): партия, заявки, журнал, у Ноктюрна — районы. Только чтение. */
export function TableStatePanel({ campaign, close }: { campaign: LocalCampaignRecord; close?: () => void }) {
  const port = useExternal()
  const table = liveTable(campaign)
  const system = table?.system ?? 'kk9'
  const externalId = table?.link.externalId
  const [view, setView] = useState<TableView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    if (!externalId) return
    setBusy(true); setError(null)
    const read = system === 'nocturne' ? port.nocturneState(externalId).then(nocturneView) : port.kk9State(externalId).then(kk9View)
    read.then((next) => setView(next), (failure: unknown) => setError(failure instanceof Error ? failure.message : `${LIVE_TABLE_LABEL[system]} не ответил`)).finally(() => setBusy(false))
  }, [port, system, externalId])
  useEffect(() => { load() }, [load])
  const label = LIVE_TABLE_LABEL[system]
  const of = LIVE_TABLE_OF[system]
  const districts = view?.districts?.filter(notableDistrict) ?? []

  return <aside className="plan-add-panel kk9-state" aria-label={`Состояние ${of}`}>
    <header><h2>{label}{table ? ` · ${table.link.label}` : ''}</h2><div className="row"><Button size="sm" icon="refresh-cw" disabled={busy || !table} onClick={load}>{busy ? 'Читаем…' : 'Обновить'}</Button>{close && <Button size="sm" icon="x" aria-label={`Закрыть панель ${of}`} onClick={close} />}</div></header>
    {!table && <p className="muted">Кампания не связана со столом. Связь ставит владелец в «Интеграциях».</p>}
    {error && <p className="local-session-error" role="alert">{error}</p>}
    {view && <>
      <section aria-label={`Стол ${of}`}>
        <dl className="kk9-state__facts">{view.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
        {view.note && <p className="muted">{view.note}</p>}
      </section>
      <section aria-label={`Партия ${of}`}>
        <h3>Партия</h3>
        {view.party.length ? <div className="session-live-panel__list">{view.party.map((member) => <article key={member.id} aria-label={`Партия: ${member.name}`}>
          <div className="row"><strong>{member.name}</strong>{member.flags.map((flag) => <Badge key={flag} size="sm" tone="danger">{flag}</Badge>)}</div>
          {member.subtitle && <small className="muted">{member.subtitle}</small>}
          {member.lines.map((line) => <small key={line} className="mb-data">{line}</small>)}
          {member.statuses.length > 0 && <div className="row">{member.statuses.map((status, index) => <Badge key={`${status.name}-${index}`} size="sm" tone="neutral">{status.name}{status.term ? ` (${status.term})` : ''}</Badge>)}</div>}
        </article>)}</div> : <p className="muted">{view.emptyParty}</p>}
        {view.partyNote && <p className="muted">{view.partyNote}</p>}
      </section>
      {view.districts && <section aria-label={`Районы ${of}`}>
        <h3>Районы карты</h3>
        {districts.length ? <ul className="kk9-state__list">{districts.map((district) => <li key={district.id}><span className="panel-kicker">{district.tensionLabel}{district.faction ? ` · ${district.faction}` : ''}{district.unavailable ? ' · закрыт' : ''}</span><strong>{district.name}</strong>{district.description && <small>{district.description}</small>}</li>)}</ul> : <p className="muted">На карте спокойно: держателей и напряжения нет.</p>}
      </section>}
      <section aria-label={`${view.requestsTitle} ${of}`}>
        <h3>{view.requestsTitle}</h3>
        {view.requests.length ? <ul className="kk9-state__list">{view.requests.map((request) => <li key={request.id}><span className="panel-kicker">{request.kicker}</span><strong>{request.name || 'без названия'}</strong>{request.description && <small>{request.description}</small>}</li>)}</ul> : <p className="muted">Открытых заявок нет.</p>}
      </section>
      <section aria-label={`${view.journalTitle} ${of}`}>
        <h3>{view.journalTitle}</h3>
        {view.journal.length ? <ul className="kk9-state__list">{view.journal.map((page) => <li key={page.id}><span className="panel-kicker">{page.kicker}{page.at ? ` · ${day(page.at)}` : ''}</span><strong>{page.title || '(без заголовка)'}</strong>{page.body && <small>{page.body.length > 240 ? `${page.body.slice(0, 240)}…` : page.body}</small>}</li>)}</ul> : <p className="muted">{view.journalTitle} пуст{view.journalTitle === 'Хроника' ? 'а' : ''}.</p>}
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

type SendProps = {
  campaign: LocalCampaignRecord
  session: LocalSessionRecord
  persist: Persist
  itemTitle: (item: LocalSessionPlanItem) => string
  canSend: boolean
  hint?: string
}

/** Отправка итогов в связанный стол: у КК9 — страница журнала, у Ноктюрна — посты хроники и районы. */
export function TableSendPanel(props: SendProps) {
  const table = liveTable(props.campaign)
  if (!table) return null
  return table.system === 'nocturne' ? <NocturneSendPanel {...props} /> : <Kk9SendPanel {...props} />
}

type Clash = { title: string; body: string; fingerprint?: number }

/**
 * Итоги разбора — в Ноктюрн (11-B, 12-B, 13-C): пост резюме (хроника или
 * «только мастеру»), «Новое в мире» отдельным открытым постом, дата и время
 * следующей игры, напряжение и держатели районов карты. Повтор переписывает
 * те же посты; правку в Ноктюрне после прошлой отправки мост ловит конфликтом.
 */
export function NocturneSendPanel({ campaign, session, persist, itemTitle, canSend, hint }: SendProps) {
  const port = useExternal()
  const link = campaign.integrations.nocturne
  const sent = session.nocturneSent
  const [stream, setStream] = useState<NocturneStream>(sent?.stream ?? 'campaign')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [clashes, setClashes] = useState<{ journal?: Clash; news?: Clash }>({})
  const [map, setMap] = useState<NocturneState | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [changes, setChanges] = useState<Record<string, NocturneDistrictChange>>({})
  if (!link) return null
  const { recap, news } = nocturnePosts(session, itemTitle)
  const next = nocturneNextSession(session.nextGame)
  const districtChanges = Object.values(changes)

  const loadMap = () => {
    setMapError(null)
    port.nocturneState(link.externalId).then(setMap, (failure: unknown) => setMapError(failure instanceof Error ? failure.message : 'Ноктюрн не ответил'))
  }
  const change = (id: string, patch: Omit<NocturneDistrictChange, 'id'>) => {
    const district = map?.districts.find((item) => item.id === id)
    const merged = { ...changes[id], id, ...patch }
    const same = district && (merged.tension === undefined || merged.tension === district.tension) && (merged.factionId === undefined || merged.factionId === district.factionId)
    const rest = { ...changes }
    delete rest[id]
    setChanges(same ? rest : { ...rest, [id]: merged })
  }

  const send = async (force = false) => {
    setBusy(true); setNote(null)
    try {
      const sameStream = sent && sent.stream === stream
      const body: NocturneSessionBody = {
        journal: { stream, ...recap, ...(sameStream ? { expectedFingerprint: sent!.fingerprint } : {}), ...(force && clashes.journal ? { force: true } : {}) },
        ...(news ? { news: { ...news, ...(sent?.newsFingerprint !== undefined ? { expectedFingerprint: sent.newsFingerprint } : {}), ...(force && clashes.news ? { force: true } : {}) } } : {}),
        ...(next ? { nextSession: next } : {}),
        ...(districtChanges.length ? { districts: districtChanges } : {}),
      }
      const result = await port.sendNocturneSession(link.externalId, session.id, body)
      const lines: string[] = []
      let record = sent
      const nextClashes: { journal?: Clash; news?: Clash } = {}
      if (result.journal?.ok && result.journal.id && result.journal.fingerprint !== undefined) {
        record = { ...(record ?? {}), stream, postId: result.journal.id, fingerprint: result.journal.fingerprint, sentAt: new Date().toISOString() }
        lines.push(`Хроника Ноктюрна (${NOCTURNE_STREAM_LABEL[stream]}): записано.`)
      } else if (result.journal && !result.journal.ok) {
        if (result.journal.status === 409 && result.journal.current) nextClashes.journal = result.journal.current
        lines.push(`Резюме: ${result.journal.error}`)
      }
      if (result.news?.ok && result.news.id && result.news.fingerprint !== undefined) {
        if (record) record = { ...record, newsId: result.news.id, newsFingerprint: result.news.fingerprint }
        lines.push('«Новое в мире»: записано.')
      } else if (result.news && !result.news.ok) {
        if (result.news.status === 409 && result.news.current) nextClashes.news = result.news.current
        lines.push(`«Новое в мире»: ${result.news.error}`)
      }
      if (result.nextSession?.ok && next) {
        if (record) record = { ...record, nextSession: nocturneDateText(next.date ?? '', next.time) }
        lines.push(`Следующая игра в Ноктюрне: ${nocturneDateText(next.date ?? '', next.time)}.`)
      } else if (result.nextSession && !result.nextSession.ok) lines.push(`Дата игры: ${result.nextSession.error}`)
      if (result.districts?.ok) {
        lines.push(`Районы карты: обновлено ${districtChanges.length}.`)
        setChanges({})
        if (map) loadMap()
      } else if (result.districts && !result.districts.ok) lines.push(`Районы: ${result.districts.error}`)
      setClashes(nextClashes)
      if (record !== sent) persist(withSession(campaign, { ...session, nocturneSent: record }))
      setNote(lines.join(' '))
    } catch (failure) {
      setNote(failure instanceof Error ? failure.message : 'Ноктюрн не ответил')
    } finally {
      setBusy(false)
    }
  }
  const keepTheirs = () => {
    // Оставить как в Ноктюрне: запомнить нынешние посты своими, чтобы следующая отправка не спорила с ними.
    if (sent) {
      persist(withSession(campaign, { ...session, nocturneSent: {
        ...sent,
        ...(clashes.journal?.fingerprint !== undefined ? { stream, fingerprint: clashes.journal.fingerprint } : {}),
        ...(clashes.news?.fingerprint !== undefined ? { newsFingerprint: clashes.news.fingerprint } : {}),
      } }))
    }
    setNote('Посты в Ноктюрне оставлены как есть. Следующая отправка перепишет их без вопроса.')
    setClashes({})
  }
  const clashList = (Object.entries(clashes) as Array<[keyof typeof clashes, Clash]>).filter(([, value]) => value)

  return <section className="kk9-send" aria-label="Отправить в Ноктюрн">
    <h3>В Ноктюрн · {link.label}</h3>
    <label>Куда резюме<Select aria-label="Видимость резюме в Ноктюрне" value={stream} onChange={(event) => setStream(event.target.value as NocturneStream)}>{NOCTURNE_STREAMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
    <details><summary>Что уйдёт: «{recap.title}»{news ? ' и «Новое в мире»' : ''}{next ? `, следующая игра — ${nocturneDateText(next.date ?? '', next.time)}` : ''}</summary>
      <pre className="kk9-send__preview">{recap.body || '(итогов пока нет — пост уйдёт с одним заголовком)'}</pre>
      {news && <pre className="kk9-send__preview">{news.title}{`\n\n${news.body}`}</pre>}
    </details>
    <details onToggle={(event) => { if ((event.currentTarget as HTMLDetailsElement).open && !map) loadMap() }}>
      <summary>Районы карты{districtChanges.length ? ` · изменено ${districtChanges.length}` : ''}</summary>
      {mapError && <p className="local-session-error" role="alert">{mapError}</p>}
      {!map && !mapError && <p className="muted">Читаем карту…</p>}
      {map && <div className="nocturne-districts" role="group" aria-label="Районы карты Ноктюрна">{map.districts.map((district) => {
        const pending = changes[district.id]
        const tension = pending?.tension ?? district.tension
        const factionId = pending?.factionId ?? district.factionId
        return <div key={district.id} className="row">
          <span>{district.name}{pending ? ' *' : ''}</span>
          <Select aria-label={`Напряжение: ${district.name}`} value={String(tension)} onChange={(event) => change(district.id, { tension: Number(event.target.value) })}>{TENSION_LABELS.map((label, index) => <option key={label} value={index}>{index} — {label}</option>)}</Select>
          <Select aria-label={`Держатель: ${district.name}`} value={factionId} onChange={(event) => change(district.id, { factionId: event.target.value })}><option value="">никто</option>{map.factions.map((faction) => <option key={faction.id} value={faction.id}>{faction.name}</option>)}</Select>
        </div>
      })}</div>}
    </details>
    {sent && <p className="muted">Отправлено {new Date(sent.sentAt).toLocaleString('ru-RU')} в «{NOCTURNE_STREAM_LABEL[sent.stream]}». Повтор перепишет те же посты.</p>}
    {clashList.length ? <div className="kk9-send__clash" role="alert">
      <p>Посты поправили в Ноктюрне после прошлой отправки. Там сейчас:</p>
      {clashList.map(([part, value]) => <pre key={part} className="kk9-send__preview">{value.title}{value.body ? `\n\n${value.body}` : ''}</pre>)}
      <div className="row"><Button variant="primary" disabled={busy || !canSend} onClick={() => void send(true)}>Перезаписать версией Masterboard</Button><Button disabled={busy} onClick={keepTheirs}>Оставить как в Ноктюрне</Button></div>
    </div> : <Button variant="primary" icon="upload" disabled={busy || !canSend} title={canSend ? undefined : hint} onClick={() => void send()}>{busy ? 'Отправляем…' : sent ? 'Отправить снова' : 'Отправить итоги в Ноктюрн'}</Button>}
    {!canSend && hint && <p className="muted" role="note">{hint}</p>}
    {note && <p role="status">{note}</p>}
  </section>
}
