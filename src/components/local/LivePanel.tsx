import { useState } from 'react'
import { Badge, Button, Select } from '../../ds'
import { changeSecretStatus, moveClock, newEntity, resolveClockTrigger } from '../../local/domain'
import { SECRET_STATUS, withSession, LOG_KIND, ENTITY_LABEL, ENTITY_TYPES } from '../../local/labels'
import { useActing } from '../../local/actingContext'
import { applyImprov, IMPROV_KIND, improvOf } from '../../local/personal'
import { logEntry, newTask } from '../../local/sessionFlow'
import { Kk9StatePanel } from './Kk9Panels'
import type { LocalCampaignEntityType, LocalCampaignRecord, LocalLogKind, LocalLogTarget, LocalSecretStatus, LocalSessionLogEntry, LocalSessionRecord } from '../../local/types'
import { useConfirm } from '../useConfirm'
import type { Persist } from './shared'
import { EntityDetails } from './EntityDetails'
import { PeekLink } from './Peek'

type Tab = 'log' | 'cards' | 'clocks' | 'secrets' | 'new' | 'improv' | 'kk9'
const CAPTURE_KINDS: LocalLogKind[] = ['moment', 'decision', 'roll']
const SENT_LABEL: Record<LocalLogTarget, string> = { task: 'В задачах', inbox: 'Во входящих', library: 'В библиотеке' }


/** Live desk shown next to the plan while a session is being played. */
export function LivePanel({ campaign, session, persist, onClose, canClose = true, closeHint }: { campaign: LocalCampaignRecord; session: LocalSessionRecord; persist: Persist; onClose: () => void; canClose?: boolean; closeHint?: string }) {
  const confirm = useConfirm()
  const acting = useActing(campaign)
  const improv = improvOf(campaign, acting.master.id).filter((item) => !item.usedAt)
  const [tab, setTab] = useState<Tab>('log')
  const [text, setText] = useState('')
  const [kind, setKind] = useState<LocalLogKind>('moment')
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [entityName, setEntityName] = useState('')
  const [entityType, setEntityType] = useState<LocalCampaignEntityType>('npc')
  const [addToPlan, setAddToPlan] = useState(true)
  const now = () => new Date().toISOString()
  const planEntityIds = new Set(session.planItems.map((item) => item.entityId).filter(Boolean))
  const planEntities = campaign.entities.filter((entity) => planEntityIds.has(entity.id))
  const log = (entry: LocalSessionLogEntry, next: LocalCampaignRecord = campaign) => {
    const current = next.sessionRecords.find((item) => item.id === session.id) ?? session
    persist(withSession(next, { ...current, log: [...current.log, entry] }))
  }

  const capture = () => { if (!text.trim()) return; log(logEntry(kind, text, now())); setText('') }
  const moveLiveClock = (clockId: string, delta: number) => {
    const clock = campaign.clocks.find((item) => item.id === clockId)
    if (!clock) return
    const result = moveClock(clock, delta, reasons[clockId] ?? '', now())
    if (!result) return
    const reached = result.reached.map((item) => ` Отметка ${item.at}: ${item.consequence}.`).join('')
    log(logEntry('clock', `Часы «${clock.title}» ${delta > 0 ? '+1' : '−1'} (${result.clock.value}/${clock.segments}): ${reasons[clockId]?.trim()}.${reached}`, now(), { clockId }), { ...campaign, clocks: campaign.clocks.map((item) => item.id === clockId ? result.clock : item) })
    setReasons({ ...reasons, [clockId]: '' })
  }
  const resolveLiveClock = (clockId: string, decision: 'fired' | 'deferred') => {
    const clock = campaign.clocks.find((item) => item.id === clockId)
    if (!clock) return
    const next = { ...campaign, clocks: campaign.clocks.map((item) => item.id === clockId ? resolveClockTrigger(item, decision, now()) : item) }
    if (decision === 'fired') log(logEntry('clock', `Сработали часы «${clock.title}»: ${clock.trigger || 'событие не описано'}`, now(), { clockId }), next)
    else persist(next)
  }
  const revealLive = (secretId: string, status: LocalSecretStatus) => {
    const secret = campaign.secrets.find((item) => item.id === secretId)
    if (!secret || secret.status === status) return
    const next = changeSecretStatus(secret, { status, recipients: secret.recipients, sessionId: session.id, note: 'Во время сессии' }, now())
    // Revealing a planned secret at the table means its plan item was played.
    const revealed = status === 'partial' || status === 'selected' || status === 'everyone'
    const played = revealed ? { ...session, planItems: session.planItems.map((item) => item.secretId === secretId && (item.status === 'prepared' || item.status === 'current') ? { ...item, status: 'used' as const } : item) } : session
    log(logEntry('reveal', `Секрет «${secret.title}»: ${SECRET_STATUS[status].toLocaleLowerCase()}`, now(), { secretId }), withSession({ ...campaign, secrets: campaign.secrets.map((item) => item.id === secretId ? next : item) }, played))
  }
  const createEntity = () => {
    if (!entityName.trim()) return
    const entity = newEntity({ type: entityType, name: entityName.trim(), origin: { kind: 'live', sessionId: session.id } })
    const current = session
    const planItems = addToPlan ? [...current.planItems, { id: `plan-${crypto.randomUUID()}`, source: 'library' as const, entityId: entity.id, text: entity.name, kind: entityType === 'npc' ? 'npc' as const : 'note' as const, priority: 'useful' as const, status: 'used' as const, role: '', alternative: '', note: '', origin: 'live' as const }] : current.planItems
    const next = withSession({ ...campaign, entities: [...campaign.entities, entity] }, { ...current, planItems })
    log(logEntry('entity', `Появилось: ${entity.name}`, now(), { entityId: entity.id }), next)
    setEntityName('')
  }
  /** Sends a log entry on and marks it in the same write, so the mark survives a reload. */
  const sendEntry = (entry: LocalSessionLogEntry, sentTo: LocalLogTarget, next: LocalCampaignRecord) => {
    if (entry.sentTo) return
    persist(withSession(next, { ...session, log: session.log.map((item) => item.id === entry.id ? { ...item, sentTo } : item) }))
  }
  const toTask = (entry: LocalSessionLogEntry) => sendEntry(entry, 'task', { ...campaign, tasks: [...campaign.tasks, newTask(entry.text, 'session', { sessionId: session.id, logEntryId: entry.id, entityId: entry.entityId, clockId: entry.clockId })] })
  const toInbox = (entry: LocalSessionLogEntry) => sendEntry(entry, 'inbox', { ...campaign, inbox: [...campaign.inbox, { id: `inbox-${crypto.randomUUID()}`, text: entry.text, tags: ['сессия'], createdAt: now() }] })
  const toLibrary = (entry: LocalSessionLogEntry) => sendEntry(entry, 'library', { ...campaign, entities: [...campaign.entities, newEntity({ type: 'note', name: entry.text.slice(0, 80), description: entry.text, origin: { kind: 'live', sessionId: session.id } })] })
  // Tasks made before `sentTo` existed still carry the entry id.
  const sentOf = (entry: LocalSessionLogEntry): LocalLogTarget | undefined => entry.sentTo ?? (campaign.tasks.some((task) => task.origin?.logEntryId === entry.id) ? 'task' : undefined)
  const close = () => confirm({ title: 'Закрыть сессию?', message: 'Живая панель закроется, и откроется разбор. Журнал сохранится, а разбор можно вернуть в работу позже.', confirmLabel: 'Закрыть и разобрать', cancelLabel: 'Продолжить игру', onConfirm: onClose })
  const planSecretIds = new Set(session.planItems.flatMap((item) => item.secretId ? [item.secretId] : []))
  const secrets = [...campaign.secrets].sort((a, b) => Number(planSecretIds.has(b.id)) - Number(planSecretIds.has(a.id)))

  return <aside className="session-live-panel" aria-label="Живая панель" tabIndex={-1}>
    <header><div><span className="panel-kicker">Сессия идёт</span><h2>Живая панель</h2></div><Button tone="danger" icon="check" disabled={!canClose} title={canClose ? undefined : closeHint} onClick={close}>Закрыть сессию</Button></header>
    <div className="session-live-panel__capture"><Select aria-label="Вид записи" value={kind} onChange={(e) => setKind(e.target.value as LocalLogKind)}>{CAPTURE_KINDS.map((value) => <option key={value} value={value}>{LOG_KIND[value]}</option>)}</Select><input value={text} placeholder="Что случилось фактически…" aria-label="Запись живого журнала" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') capture() }} /><Button variant="primary" disabled={!text.trim()} onClick={capture}>Сохранить момент</Button></div>
    <nav className="control-center__tabs" aria-label="Разделы живой панели">{([['log', 'Журнал', session.log.length], ['cards', 'Карточки', planEntities.length], ['clocks', 'Часы', campaign.clocks.length], ['secrets', 'Секреты', campaign.secrets.length], ['new', 'Новое', undefined], ['improv', 'Заготовки', improv.length], ...(campaign.integrations.kk9 ? [['kk9', 'КК9', undefined] as const] : [])] as const).map(([id, label, count]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}{count !== undefined && <span>{count}</span>}</button>)}</nav>
    {tab === 'log' && <ol className="session-live-panel__log">{[...session.log].reverse().map((entry) => <li key={entry.id}><time>{new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time><div><Badge size="sm" tone={entry.kind === 'moment' ? 'neutral' : 'accent'}>{LOG_KIND[entry.kind]}</Badge><span>{entry.text}</span>{sentOf(entry) ? <small>{SENT_LABEL[sentOf(entry)!]}</small> : <div className="row"><Button size="sm" onClick={() => toTask(entry)}>В задачу</Button><Button size="sm" onClick={() => toInbox(entry)}>Во входящие</Button>{entry.kind !== 'entity' && <Button size="sm" onClick={() => toLibrary(entry)}>В библиотеку</Button>}</div>}</div></li>)}{!session.log.length && <li className="muted">Журнал пуст. Записывайте, что произошло фактически.</li>}</ol>}
    {tab === 'cards' && <div className="session-live-panel__list">{planEntities.map((entity) => <article key={entity.id} aria-label={`Карточка: ${entity.name}`}><div className="row"><strong><PeekLink target={{ kind: 'entity', id: entity.id }}>{entity.name}</PeekLink></strong><Badge size="sm" tone="neutral">{ENTITY_LABEL[entity.type]}</Badge></div>{entity.description && <p>{entity.description}</p>}<EntityDetails entity={entity} className="campaign-local-library__fields" /></article>)}{!planEntities.length && <p className="muted">В плане нет сущностей из библиотеки.</p>}</div>}
    {tab === 'clocks' && <div className="session-live-panel__list">{campaign.clocks.map((clock) => { const full = clock.value === clock.segments; return <article key={clock.id} aria-label={`Часы: ${clock.title}`}><div className="row"><strong>{clock.title}</strong><span className="mb-data">{clock.value}/{clock.segments}</span></div>{full && clock.triggerStatus !== 'fired' ? <div className="row"><span className="local-session-error">Заполнены: {clock.trigger || 'событие не описано'}</span><Button size="sm" onClick={() => resolveLiveClock(clock.id, 'deferred')}>Позже</Button><Button size="sm" variant="primary" onClick={() => resolveLiveClock(clock.id, 'fired')}>Сработало</Button></div> : null}<div className="row"><input aria-label={`Причина: ${clock.title}`} value={reasons[clock.id] ?? ''} placeholder="Причина…" onChange={(e) => setReasons({ ...reasons, [clock.id]: e.target.value })} /><Button size="sm" aria-label={`Откатить ${clock.title}`} disabled={!clock.value || !reasons[clock.id]?.trim()} onClick={() => moveLiveClock(clock.id, -1)}>−1</Button><Button size="sm" variant="primary" aria-label={`Продвинуть ${clock.title}`} disabled={full || !reasons[clock.id]?.trim()} onClick={() => moveLiveClock(clock.id, 1)}>+1</Button></div></article> })}{!campaign.clocks.length && <p className="muted">Часов нет. Их можно завести в «Пульте».</p>}</div>}
    {tab === 'secrets' && <div className="session-live-panel__list">{secrets.map((secret) => <article key={secret.id}><div className="row"><strong>{secret.title}</strong>{planSecretIds.has(secret.id) && <Badge size="sm" tone="accent">В плане</Badge>}</div>{secret.revealCondition && <small>Раскрыть: {secret.revealCondition}</small>}<Select aria-label={`Состояние секрета: ${secret.title}`} value={secret.status} onChange={(e) => revealLive(secret.id, e.target.value as LocalSecretStatus)}>{Object.entries(SECRET_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></article>)}{!campaign.secrets.length && <p className="muted">Секретов нет.</p>}</div>}
    {tab === 'kk9' && <Kk9StatePanel campaign={campaign} />}
    {tab === 'improv' && <div className="session-live-panel__list">{improv.map((item) => <article key={item.id}><div className="row"><strong>{item.text}</strong><Badge size="sm" tone="neutral">{IMPROV_KIND[item.kind]}</Badge></div><Button size="sm" variant="primary" aria-label={`Использовать заготовку ${item.text}`} onClick={() => persist(applyImprov(campaign, item.id, now(), session))}>Использовать</Button></article>)}{!improv.length && <p className="muted">Личный лист {acting.master.name} пуст. Заготовки пополняются в разделе «Заготовки».</p>}</div>}
    {tab === 'new' && <div className="session-live-panel__new"><div className="row"><Select aria-label="Тип новой сущности" value={entityType} onChange={(e) => setEntityType(e.target.value as LocalCampaignEntityType)}>{ENTITY_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select><input aria-label="Имя новой сущности" value={entityName} placeholder="Трактирщик Бран…" onChange={(e) => setEntityName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createEntity() }} /></div><label className="local-checkbox"><input type="checkbox" checked={addToPlan} onChange={(e) => setAddToPlan(e.target.checked)} /> Отметить в плане как использованное</label><Button variant="primary" icon="plus" disabled={!entityName.trim()} onClick={createEntity}>Создать в библиотеке</Button></div>}
  </aside>
}
