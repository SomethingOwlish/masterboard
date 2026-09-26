import { useState } from 'react'
import { Badge, Button, EmptyState, Select } from '../../ds'
import type { PublicationOperation, PublicationQueueItem } from '../../model/external'
import { confirmSelected, enqueue, FAKE_CONNECTIONS, fakeGateway, OPERATION_LABEL, previewDrafts, reasonLabel, retrySelected, sendConfirmed, STATE_LABEL } from '../../local/publishing'
import { useConfirm } from '../useConfirm'
import { ENTITY_LABEL, type SectionProps } from './shared'

const OPERATIONS: PublicationOperation[] = ['create', 'update', 'change-visibility', 'archive']
const TONE: Record<PublicationQueueItem['state'], 'neutral' | 'accent' | 'warning' | 'success' | 'danger'> = { draft: 'neutral', ready: 'accent', blocked: 'warning', succeeded: 'success', failed: 'danger' }

/** Batch manager: queue → check → confirm → send → retry, against fake destinations. */
export function PublishSection({ campaign, persist }: SectionProps) {
  const confirm = useConfirm()
  const entities = campaign.entities.filter((entity) => entity.status !== 'archived')
  const [entityId, setEntityId] = useState('')
  const [connectionId, setConnectionId] = useState(FAKE_CONNECTIONS[0].id)
  const [operation, setOperation] = useState<PublicationOperation>('create')
  const [selected, setSelected] = useState<string[]>([])
  const [failing, setFailing] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const queue = campaign.publications.filter((item) => item.state !== 'succeeded')
  const history = campaign.publications.filter((item) => item.state === 'succeeded')
  const confirmed = queue.filter((item) => item.state === 'ready' && item.confirmedAt)
  const entityName = (id: string) => campaign.entities.find((entity) => entity.id === id)?.name ?? 'Удалённая сущность'
  const connectionName = (id: string) => FAKE_CONNECTIONS.find((connection) => connection.id === id)?.label ?? id
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id])
  const now = () => new Date().toISOString()

  const add = () => { if (!entityId) return; persist(enqueue(campaign, entityId, connectionId, operation, now())); setMessage(null) }
  const check = async () => { persist(await previewDrafts(campaign, fakeGateway(campaign.publications, new Set(failing)))); setMessage('Черновики проверены по возможностям назначений.') }
  const confirmChosen = () => { persist(confirmSelected(campaign, selected, now())); setSelected([]) }
  const send = () => confirm({ title: `Отправить ${confirmed.length} операций?`, message: 'Назначения тестовые: данные никуда не уйдут, но результат каждой операции сохранится.', confirmLabel: 'Отправить', cancelLabel: 'Отмена', tone: 'accent', onConfirm: () => { void sendConfirmed(campaign, fakeGateway(campaign.publications, new Set(failing)), now()).then((result) => { persist(result.campaign); setMessage(`Отправлено: ${result.succeeded}. Ошибок: ${result.failed}.`) }) } })
  const retry = () => { persist(retrySelected(campaign, selected, now())); setSelected([]) }
  const remove = (id: string) => persist({ ...campaign, publications: campaign.publications.filter((item) => item.id !== id) })

  return <section className="campaign-section publish-section">
    <div className="panel-heading"><div><span className="panel-kicker">Пакетный менеджер</span><h2>Публикация</h2><p>Соберите изменения в очередь, проверьте, подтвердите и отправьте пачкой. Каждая операция живёт отдельно: сбой одной не мешает остальным.</p></div><Badge tone="warning" dot>Тестовые назначения</Badge></div>

    <div className="publish-section__composer" role="group" aria-label="Добавить в очередь">
      <Select aria-label="Что публикуем" value={entityId} onChange={(e) => setEntityId(e.target.value)}><option value="">Сущность…</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {ENTITY_LABEL[entity.type]}{entity.visibility === 'master' ? ' · только ведущим' : ''}</option>)}</Select>
      <Select aria-label="Куда" value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>{FAKE_CONNECTIONS.map((connection) => <option key={connection.id} value={connection.id}>{connection.label}</option>)}</Select>
      <Select aria-label="Операция" value={operation} onChange={(e) => setOperation(e.target.value as PublicationOperation)}>{OPERATIONS.map((value) => <option key={value} value={value}>{OPERATION_LABEL[value]}</option>)}</Select>
      <Button icon="plus" disabled={!entityId} onClick={add}>В очередь</Button>
    </div>
    {entityId && campaign.entities.find((entity) => entity.id === entityId)?.visibility === 'master' && <p className="local-session-error">Эта сущность видна только ведущим. Проверьте, что её можно показывать за пределами Masterboard.</p>}

    <div className="publish-section__actions"><Button disabled={!queue.some((item) => item.state === 'draft' || item.state === 'blocked')} onClick={() => void check()}>1. Проверить черновики</Button><Button disabled={!selected.some((id) => queue.find((item) => item.id === id)?.state === 'ready')} onClick={confirmChosen}>2. Подтвердить выбранные</Button><Button variant="primary" icon="upload" disabled={!confirmed.length} onClick={send}>3. Отправить подтверждённые ({confirmed.length})</Button><Button disabled={!selected.some((id) => queue.find((item) => item.id === id)?.state === 'failed')} onClick={retry}>Повторить выбранные</Button></div>
    {message && <p className="muted" role="status">{message}</p>}

    {queue.length ? <ul className="publish-section__queue" aria-label="Очередь публикации">{queue.map((item) => <li key={item.id} className={`publish-item publish-item--${item.state}`}>
      <input type="checkbox" aria-label={`Выбрать: ${entityName(item.entityId)} → ${connectionName(item.connectionId)}`} checked={selected.includes(item.id)} disabled={item.state === 'draft' || item.state === 'blocked'} onChange={() => toggle(item.id)} />
      <div><strong>{entityName(item.entityId)}</strong><small>{OPERATION_LABEL[item.operation]} → {connectionName(item.connectionId)}</small>{item.error && <small className="local-session-error">{reasonLabel(item.error)}</small>}</div>
      <Badge size="sm" tone={TONE[item.state]}>{item.state === 'ready' && item.confirmedAt ? 'Подтверждено' : STATE_LABEL[item.state]}</Badge>
      {(item.state === 'draft' || item.state === 'blocked') && <Button size="sm" tone="danger" icon="trash-2" aria-label={`Убрать из очереди: ${entityName(item.entityId)}`} onClick={() => remove(item.id)} />}
    </li>)}</ul> : <EmptyState icon="upload" title="Очередь пуста" hint="Выберите сущность и назначение, чтобы подготовить публикацию." />}

    <fieldset className="local-checklist publish-section__failures"><legend>Имитация сбоя (для проверки повторов)</legend>{FAKE_CONNECTIONS.map((connection) => <label key={connection.id}><input type="checkbox" checked={failing.includes(connection.id)} onChange={() => setFailing(failing.includes(connection.id) ? failing.filter((id) => id !== connection.id) : [...failing, connection.id])} /> {connection.label} не отвечает</label>)}</fieldset>

    {history.length > 0 && <details className="improv-used"><summary>История отправок · {history.length}</summary><ul>{history.map((item) => <li key={item.id}>{entityName(item.entityId)} — {OPERATION_LABEL[item.operation].toLocaleLowerCase()} → {connectionName(item.connectionId)} <small>{item.completedAt ? new Date(item.completedAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</small></li>)}</ul></details>}
  </section>
}
