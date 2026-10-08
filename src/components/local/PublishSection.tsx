import { useState } from 'react'
import { Badge, Button, EmptyState, Select } from '../../ds'
import type { PublicationOperation, PublicationQueueItem } from '../../model/external'
import { Link } from 'react-router-dom'
import { ROLE_LABEL, SYSTEM_LABEL, WRITABLE_ROLES, linkedRole, parseConnectionKey, roleConnection, targetTypes } from '../../local/integration'
import { plural, ENTITY_LABEL } from '../../local/labels'
import { canRemove, confirmSelected, enqueue, enqueueByRoles, pendingByRoles, pickHint, OPERATION_LABEL, previewDrafts, reasonLabel, removeQueued, retrySelected, sendConfirmed, STATE_LABEL, unconfirm } from '../../local/publishing'
import type { LocalCampaignRecord } from '../../local/types'
import { exportSessionResults } from '../../local/aiExport'
import { downloadText } from '../../local/download'
import { liveSessions } from '../../local/sessions'
import { useConnections, useExternal, usePassports } from '../../local/useExternal'
import { useConfirm } from '../useConfirm'
import type { SectionProps } from './shared'

const OPERATIONS: PublicationOperation[] = ['create', 'update', 'change-visibility', 'archive']
const TONE: Record<PublicationQueueItem['state'], 'neutral' | 'accent' | 'warning' | 'success' | 'danger'> = { draft: 'neutral', ready: 'accent', blocked: 'warning', succeeded: 'success', failed: 'danger' }

/** Batch manager: queue → check → confirm → send → retry, into lorebook and lovegame through lorebridge. */
export function PublishSection({ campaign, persist }: SectionProps) {
  const confirm = useConfirm()
  const port = useExternal()
  const connectionsState = useConnections()
  const entities = campaign.entities.filter((entity) => entity.status !== 'archived')
  const destinations = WRITABLE_ROLES.flatMap((role) => { const linked = linkedRole(campaign, role); return linked ? [{ id: roleConnection(linked.system, linked.link), system: linked.system, label: `${ROLE_LABEL[role]} · ${SYSTEM_LABEL[linked.system]} · ${linked.link.label}` }] : [] })
  const pending = pendingByRoles(campaign)
  const [entityId, setEntityId] = useState('')
  const [connectionId, setConnectionId] = useState('')
  const [operation, setOperation] = useState<PublicationOperation>('create')
  const [targetType, setTargetType] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resultsOf, setResultsOf] = useState('')
  const destinationId = destinations.some((item) => item.id === connectionId) ? connectionId : destinations[0]?.id ?? ''
  const queue = campaign.publications.filter((item) => item.state !== 'succeeded')
  const history = campaign.publications.filter((item) => item.state === 'succeeded')
  const confirmed = queue.filter((item) => item.state === 'ready' && item.confirmedAt)
  const passports = usePassports([destinationId, ...queue.map((item) => item.connectionId)].filter(Boolean))
  const entity = campaign.entities.find((item) => item.id === entityId)
  const typeOptions = (connection: string, type: LocalCampaignRecord['entities'][number]['type']) => targetTypes(passports[connection], parseConnectionKey(connection).system, type)
  const chosenType = entity && destinationId ? (typeOptions(destinationId, entity.type).some((item) => item.id === targetType) ? targetType : typeOptions(destinationId, entity.type)[0]?.id ?? '') : ''
  const entityName = (id: string) => campaign.entities.find((item) => item.id === id)?.name ?? 'Удалённая сущность'
  const connectionName = (id: string) => destinations.find((item) => item.id === id)?.label ?? (() => { const { system, externalId } = parseConnectionKey(id); return `${SYSTEM_LABEL[system] ?? system} · ${externalId}` })()
  const typeLabel = (item: PublicationQueueItem) => passports[item.connectionId]?.entities.find((entry) => entry.entityType === item.targetType)?.label ?? item.targetType
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id])
  const now = () => new Date().toISOString()

  const queueByRules = () => { const stamp = now(); persist(pending.reduce((next, id) => enqueueByRoles(next, id, stamp), campaign)); setMessage(`В очередь по правилам: ${pending.length}.`) }
  const add = () => { if (!entityId || !destinationId) return; persist(enqueue(campaign, entityId, destinationId, operation, now(), chosenType || undefined)); setMessage(null) }
  const setItemType = (id: string, value: string) => persist({ ...campaign, publications: campaign.publications.map((item) => item.id === id ? { ...item, targetType: value, state: 'draft', error: undefined } : item) })
  const check = async () => {
    setBusy(true)
    try {
      persist(await previewDrafts(campaign, port))
      setMessage('Черновики проверены по возможностям подключённых систем.')
    } catch (error) {
      setMessage(`Проверка не удалась: ${error instanceof Error ? error.message : 'нет ответа'}. Попробуйте ещё раз.`)
    } finally {
      setBusy(false)
    }
  }
  const confirmChosen = () => { persist(confirmSelected(campaign, selected, now())); setSelected([]) }
  const send = () => confirm({ title: `Отправить ${confirmed.length} ${plural(confirmed.length, 'операцию', 'операции', 'операций')}?`, message: 'Изменения уйдут в подключённые мир и стол и станут видны там по их правилам доступа. Результат каждой операции сохранится здесь.', confirmLabel: 'Отправить', cancelLabel: 'Отмена', tone: 'accent', onConfirm: () => { setBusy(true); void sendConfirmed(campaign, port, now()).then((result) => { persist(result.campaign); setMessage(`Отправлено: ${result.succeeded}. Ошибок: ${result.failed}.${result.blocked ? ` Заблокировано: ${result.blocked} — подключение отвязано.` : ''}`) }, (error: unknown) => setMessage(error instanceof Error ? error.message : 'Не удалось отправить')).finally(() => setBusy(false)) } })
  const retry = () => { persist(retrySelected(campaign, selected, now())); setSelected([]) }
  const remove = (id: string) => persist(removeQueued(campaign, id))
  const sessions = liveSessions(campaign).sort((a, b) => a.number - b.number)
  const resultsSession = sessions.find((item) => item.id === resultsOf)
  const exportResults = () => {
    const slug = campaign.name.replace(/[^\p{L}\p{N}]+/gu, '-')
    downloadText(`${slug}-${resultsSession ? `сессия-${String(resultsSession.number).padStart(2, '0')}` : 'все-сессии'}.ai.json`, exportSessionResults(campaign, now(), resultsSession?.id))
  }

  return <section className="campaign-section publish-section">
    <div className="section-bar"><div><span className="panel-kicker">Обмен</span><h2>Публикация</h2></div><p className="muted">Очередь → проверка → подтверждение → отправка. Куда что уходит — в <Link to={`/local/campaign/${campaign.id}/integrations`}>«Интеграциях»</Link>.</p></div>

    <div className="publish-section__rules" role="group" aria-label="Результаты сессий для ИИ">
      <span><strong>Результаты сессий для ИИ</strong> — журнал, разбор, секреты, часы и новое в мире одним JSON.</span>
      <div className="row">
        <Select aria-label="Какие сессии выгрузить" value={resultsSession?.id ?? ''} onChange={(e) => setResultsOf(e.target.value)}><option value="">Все сессии</option>{sessions.map((item) => <option key={item.id} value={item.id}>№{item.number} {item.title}</option>)}</Select>
        <Button icon="download" disabled={!sessions.length} onClick={exportResults}>JSON для ИИ</Button>
      </div>
    </div>

    {connectionsState.status === 'loading' && <p className="muted" role="status">Узнаём, какие миры и кампании вам доступны…</p>}
    {(connectionsState.status === 'unconfigured' || connectionsState.status === 'error') && <p className="local-session-error" role="alert">{connectionsState.status === 'unconfigured' ? 'Связь с внешними системами ещё не настроена на сервере Мастерборда.' : connectionsState.message}</p>}
    {destinations.length > 0 && (
      <div className="publish-section__rules" role="group" aria-label="Пачка по правилам">
        <span>
          <strong>По правилам: {pending.length} {plural(pending.length, 'сущность', 'сущности', 'сущностей')}</strong>
          {pending.length ? ' — новые или изменённые с последней отправки.' : ' — всё отправлено.'}
        </span>
        <Button icon="list-checks" disabled={!pending.length} onClick={queueByRules}>Поставить в очередь</Button>
      </div>
    )}

    {destinations.length > 0 ? <div className="publish-section__composer" role="group" aria-label="Добавить в очередь">
      <Select aria-label="Что публикуем" value={entityId} onChange={(e) => setEntityId(e.target.value)}><option value="">Сущность…</option>{entities.map((item) => <option key={item.id} value={item.id}>{item.name} · {ENTITY_LABEL[item.type]}{item.visibility === 'master' ? ' · только мастерам' : ''}</option>)}</Select>
      <Select aria-label="Куда" value={destinationId} onChange={(e) => setConnectionId(e.target.value)}>{destinations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>
      <Select aria-label="Операция" value={operation} onChange={(e) => setOperation(e.target.value as PublicationOperation)}>{OPERATIONS.map((value) => <option key={value} value={value}>{OPERATION_LABEL[value]}</option>)}</Select>
      {entity && <Select aria-label="Тип там" value={chosenType} onChange={(e) => setTargetType(e.target.value)}>{typeOptions(destinationId, entity.type).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>}
      <Button icon="plus" disabled={!entityId} onClick={add}>В очередь</Button>
    </div> : <p className="muted">Кампания пока не подключена к миру или столу. <Link to={`/local/campaign/${campaign.id}/integrations`}>Подключить</Link></p>}
    {entity?.visibility === 'master' && <p className="local-session-error">Эта сущность видна только мастерам. В Лорбуке она будет скрытой, в ЛавГеймс — не видна игрокам.</p>}

    <div className="publish-section__actions"><Button disabled={busy || !queue.some((item) => item.state === 'draft' || item.state === 'blocked')} onClick={() => void check()}>1. Проверить черновики</Button><Button disabled={!selected.some((id) => queue.find((item) => item.id === id)?.state === 'ready')} onClick={confirmChosen}>2. Подтвердить выбранные</Button><Button variant="primary" icon="upload" disabled={busy || !confirmed.length} onClick={send}>3. Отправить подтверждённые ({confirmed.length})</Button><Button disabled={!selected.some((id) => queue.find((item) => item.id === id)?.state === 'failed')} onClick={retry}>Повторить выбранные</Button></div>
    {message && <p className="muted" role="status">{message}</p>}

    {queue.length ? <ul className="publish-section__queue" aria-label="Очередь публикации">{queue.map((item) => {
      const itemEntity = campaign.entities.find((candidate) => candidate.id === item.entityId)
      const editableType = item.operation === 'create' && (item.state === 'draft' || item.state === 'blocked') && itemEntity
      return <li key={item.id} className={`publish-item publish-item--${item.state}`}>
        <input
          type="checkbox"
          aria-label={`Выбрать: ${entityName(item.entityId)} → ${connectionName(item.connectionId)}`}
          title={pickHint(item)}
          checked={selected.includes(item.id)}
          disabled={Boolean(pickHint(item))}
          onChange={() => toggle(item.id)}
        />
        <div><strong>{entityName(item.entityId)}</strong><small>{OPERATION_LABEL[item.operation]} → {connectionName(item.connectionId)}{item.targetType && !editableType ? ` · ${typeLabel(item)}` : ''}</small>{editableType && <Select containerStyle={{ maxWidth: '16rem' }} aria-label={`Тип там: ${entityName(item.entityId)}`} value={item.targetType ?? ''} onChange={(e) => setItemType(item.id, e.target.value)}>{typeOptions(item.connectionId, itemEntity.type).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</Select>}{item.error && <small className="local-session-error">{reasonLabel(item.error)}</small>}</div>
        <Badge size="sm" tone={TONE[item.state]}>{item.state === 'ready' && item.confirmedAt ? 'Подтверждено' : STATE_LABEL[item.state]}</Badge>
        {item.state === 'ready' && item.confirmedAt && (
          <Button
            size="sm"
            icon="undo-2"
            aria-label={`Снять подтверждение: ${entityName(item.entityId)}`}
            title="Вернуть в «Готово к отправке»"
            onClick={() => persist(unconfirm(campaign, item.id))}
          />
        )}
        {canRemove(item) && (
          <Button
            size="sm"
            tone="danger"
            icon="trash-2"
            aria-label={`Убрать из очереди: ${entityName(item.entityId)}`}
            onClick={() => remove(item.id)}
          />
        )}
      </li>
    })}</ul> : <EmptyState icon="upload" title="Очередь пуста" hint="Выберите сущность и назначение, чтобы подготовить публикацию." />}

    {history.length > 0 && <details className="improv-used"><summary>История отправок · {history.length}</summary><ul>{history.map((item) => <li key={item.id}>{entityName(item.entityId)} — {OPERATION_LABEL[item.operation].toLocaleLowerCase()} → {connectionName(item.connectionId)} <small>{item.completedAt ? new Date(item.completedAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</small>{item.result?.url && <> · <a href={item.result.url} target="_blank" rel="noreferrer">открыть</a></>}</li>)}</ul></details>}
  </section>
}
