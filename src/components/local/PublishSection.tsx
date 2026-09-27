import { useState } from 'react'
import { Badge, Button, EmptyState, Select } from '../../ds'
import type { ExternalConnection, PublicationOperation, PublicationQueueItem } from '../../model/external'
import { useActing } from '../../local/actingContext'
import { LINKABLE_SYSTEMS, SYSTEM_LABEL, WRITABLE_SYSTEMS, connectionKey, parseConnectionKey, targetTypes, type LinkableSystem } from '../../local/integration'
import { confirmSelected, enqueue, OPERATION_LABEL, previewDrafts, reasonLabel, retrySelected, sendConfirmed, STATE_LABEL } from '../../local/publishing'
import type { LocalCampaignRecord } from '../../local/types'
import { useConnections, useExternal, usePassports } from '../../local/useExternal'
import { useConfirm } from '../useConfirm'
import { ENTITY_LABEL, type Persist, type SectionProps } from './shared'

const OPERATIONS: PublicationOperation[] = ['create', 'update', 'change-visibility', 'archive']
const TONE: Record<PublicationQueueItem['state'], 'neutral' | 'accent' | 'warning' | 'success' | 'danger'> = { draft: 'neutral', ready: 'accent', blocked: 'warning', succeeded: 'success', failed: 'danger' }

/** Where this campaign reads from and publishes to: one world in lorebook, one campaign in lovegame and in КК9 (decision F4, owner only). */
function CampaignLinks({ campaign, persist, connections }: { campaign: LocalCampaignRecord; persist: Persist; connections: ExternalConnection[] }) {
  const acting = useActing(campaign)
  const link = (system: LinkableSystem, externalId: string) => {
    const connection = connections.find((item) => item.system === system && item.externalId === externalId)
    const integrations = { ...campaign.integrations }
    if (connection) integrations[system] = { externalId, label: connection.label, url: connection.url }
    else delete integrations[system]
    persist({ ...campaign, integrations })
  }
  return <section className="publish-section__links" aria-label="Связи кампании">
    <header><h3>Связи кампании</h3><p className="muted">{acting.canManage ? 'Куда публикуют все мастера этой кампании. Меняет только владелец.' : `Меняет владелец кампании.`}</p></header>
    <dl>{LINKABLE_SYSTEMS.map((system) => {
      const current = campaign.integrations[system]
      const options = connections.filter((item) => item.system === system)
      return <div key={system}><dt>{SYSTEM_LABEL[system]}</dt><dd>{acting.canManage
        ? <Select aria-label={`Связь с ${SYSTEM_LABEL[system]}`} value={current?.externalId ?? ''} onChange={(e) => link(system, e.target.value)}><option value="">— не связано —</option>{current && !options.some((item) => item.externalId === current.externalId) && <option value={current.externalId}>{current.label} (нет доступа)</option>}{options.map((item) => <option key={item.id} value={item.externalId}>{item.label}</option>)}</Select>
        : current ? (current.url ? <a href={current.url} target="_blank" rel="noreferrer">{current.label}</a> : current.label) : <span className="muted">не связано</span>}</dd></div>
    })}<div><dt>{SYSTEM_LABEL.systemsetup}</dt><dd className="muted">только чтение — правила можно взять в библиотеку</dd></div></dl>
  </section>
}

/** Batch manager: queue → check → confirm → send → retry, into lorebook and lovegame through lorebridge. */
export function PublishSection({ campaign, persist }: SectionProps) {
  const confirm = useConfirm()
  const port = useExternal()
  const connectionsState = useConnections()
  const connections = connectionsState.status === 'ready' ? connectionsState.connections : []
  const entities = campaign.entities.filter((entity) => entity.status !== 'archived')
  const destinations = WRITABLE_SYSTEMS.flatMap((system) => { const link = campaign.integrations[system]; return link ? [{ id: connectionKey(system, link.externalId), system, label: `${SYSTEM_LABEL[system]} · ${link.label}` }] : [] })
  const [entityId, setEntityId] = useState('')
  const [connectionId, setConnectionId] = useState('')
  const [operation, setOperation] = useState<PublicationOperation>('create')
  const [targetType, setTargetType] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const destinationId = destinations.some((item) => item.id === connectionId) ? connectionId : destinations[0]?.id ?? ''
  const queue = campaign.publications.filter((item) => item.state !== 'succeeded')
  const history = campaign.publications.filter((item) => item.state === 'succeeded')
  const confirmed = queue.filter((item) => item.state === 'ready' && item.confirmedAt)
  const passports = usePassports([destinationId, ...queue.map((item) => item.connectionId)].filter(Boolean))
  const entity = campaign.entities.find((item) => item.id === entityId)
  const typeOptions = (connection: string, type: LocalCampaignRecord['entities'][number]['type']) => targetTypes(passports[connection], parseConnectionKey(connection).system, type)
  const chosenType = entity && destinationId ? (typeOptions(destinationId, entity.type).some((item) => item.id === targetType) ? targetType : typeOptions(destinationId, entity.type)[0]?.id ?? '') : ''
  const entityName = (id: string) => campaign.entities.find((item) => item.id === id)?.name ?? 'Удалённая сущность'
  const connectionName = (id: string) => { const { system, externalId } = parseConnectionKey(id); const link = campaign.integrations[system]; return `${SYSTEM_LABEL[system] ?? system} · ${link?.externalId === externalId ? link.label : externalId}` }
  const typeLabel = (item: PublicationQueueItem) => passports[item.connectionId]?.entities.find((entry) => entry.entityType === item.targetType)?.label ?? item.targetType
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id])
  const now = () => new Date().toISOString()

  const add = () => { if (!entityId || !destinationId) return; persist(enqueue(campaign, entityId, destinationId, operation, now(), chosenType || undefined)); setMessage(null) }
  const setItemType = (id: string, value: string) => persist({ ...campaign, publications: campaign.publications.map((item) => item.id === id ? { ...item, targetType: value, state: 'draft', error: undefined } : item) })
  const check = async () => { setBusy(true); try { persist(await previewDrafts(campaign, port)); setMessage('Черновики проверены по возможностям Лорбука и ЛавГеймс.') } finally { setBusy(false) } }
  const confirmChosen = () => { persist(confirmSelected(campaign, selected, now())); setSelected([]) }
  const send = () => confirm({ title: `Отправить ${confirmed.length} операций?`, message: 'Изменения уйдут в Лорбук и ЛавГеймс и станут видны там по их правилам доступа. Результат каждой операции сохранится здесь.', confirmLabel: 'Отправить', cancelLabel: 'Отмена', tone: 'accent', onConfirm: () => { setBusy(true); void sendConfirmed(campaign, port, now()).then((result) => { persist(result.campaign); setMessage(`Отправлено: ${result.succeeded}. Ошибок: ${result.failed}.`) }, (error: unknown) => setMessage(error instanceof Error ? error.message : 'Не удалось отправить')).finally(() => setBusy(false)) } })
  const retry = () => { persist(retrySelected(campaign, selected, now())); setSelected([]) }
  const remove = (id: string) => persist({ ...campaign, publications: campaign.publications.filter((item) => item.id !== id) })

  return <section className="campaign-section publish-section">
    <div className="panel-heading"><div><span className="panel-kicker">Пакетный менеджер</span><h2>Публикация</h2><p>Соберите изменения в очередь, проверьте, подтвердите и отправьте пачкой в Лорбук и ЛавГеймс. Каждая операция живёт отдельно: сбой одной не мешает остальным.</p></div></div>

    {connectionsState.status === 'loading' && <p className="muted" role="status">Узнаём, какие миры и кампании вам доступны…</p>}
    {(connectionsState.status === 'unconfigured' || connectionsState.status === 'error') && <p className="local-session-error" role="alert">{connectionsState.status === 'unconfigured' ? 'Связь с Лорбуком и ЛавГеймс ещё не настроена на сервере Мастерборда.' : connectionsState.message}</p>}
    {connectionsState.status === 'ready' && <CampaignLinks campaign={campaign} persist={persist} connections={connections} />}

    {destinations.length > 0 ? <div className="publish-section__composer" role="group" aria-label="Добавить в очередь">
      <Select aria-label="Что публикуем" value={entityId} onChange={(e) => setEntityId(e.target.value)}><option value="">Сущность…</option>{entities.map((item) => <option key={item.id} value={item.id}>{item.name} · {ENTITY_LABEL[item.type]}{item.visibility === 'master' ? ' · только ведущим' : ''}</option>)}</Select>
      <Select aria-label="Куда" value={destinationId} onChange={(e) => setConnectionId(e.target.value)}>{destinations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>
      <Select aria-label="Операция" value={operation} onChange={(e) => setOperation(e.target.value as PublicationOperation)}>{OPERATIONS.map((value) => <option key={value} value={value}>{OPERATION_LABEL[value]}</option>)}</Select>
      {entity && <Select aria-label="Тип там" value={chosenType} onChange={(e) => setTargetType(e.target.value)}>{typeOptions(destinationId, entity.type).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>}
      <Button icon="plus" disabled={!entityId} onClick={add}>В очередь</Button>
    </div> : connectionsState.status === 'ready' && <p className="muted">Свяжите кампанию с миром Лорбука или кампанией ЛавГеймс, чтобы публиковать.</p>}
    {entity?.visibility === 'master' && <p className="local-session-error">Эта сущность видна только ведущим. В Лорбуке она будет скрытой, в ЛавГеймс — не видна игрокам.</p>}

    <div className="publish-section__actions"><Button disabled={busy || !queue.some((item) => item.state === 'draft' || item.state === 'blocked')} onClick={() => void check()}>1. Проверить черновики</Button><Button disabled={!selected.some((id) => queue.find((item) => item.id === id)?.state === 'ready')} onClick={confirmChosen}>2. Подтвердить выбранные</Button><Button variant="primary" icon="upload" disabled={busy || !confirmed.length} onClick={send}>3. Отправить подтверждённые ({confirmed.length})</Button><Button disabled={!selected.some((id) => queue.find((item) => item.id === id)?.state === 'failed')} onClick={retry}>Повторить выбранные</Button></div>
    {message && <p className="muted" role="status">{message}</p>}

    {queue.length ? <ul className="publish-section__queue" aria-label="Очередь публикации">{queue.map((item) => {
      const itemEntity = campaign.entities.find((candidate) => candidate.id === item.entityId)
      const editableType = item.operation === 'create' && (item.state === 'draft' || item.state === 'blocked') && itemEntity
      return <li key={item.id} className={`publish-item publish-item--${item.state}`}>
        <input type="checkbox" aria-label={`Выбрать: ${entityName(item.entityId)} → ${connectionName(item.connectionId)}`} checked={selected.includes(item.id)} disabled={item.state === 'draft' || item.state === 'blocked'} onChange={() => toggle(item.id)} />
        <div><strong>{entityName(item.entityId)}</strong><small>{OPERATION_LABEL[item.operation]} → {connectionName(item.connectionId)}{item.targetType && !editableType ? ` · ${typeLabel(item)}` : ''}</small>{editableType && <Select containerStyle={{ maxWidth: '16rem' }} aria-label={`Тип там: ${entityName(item.entityId)}`} value={item.targetType ?? ''} onChange={(e) => setItemType(item.id, e.target.value)}>{typeOptions(item.connectionId, itemEntity.type).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</Select>}{item.error && <small className="local-session-error">{reasonLabel(item.error)}</small>}</div>
        <Badge size="sm" tone={TONE[item.state]}>{item.state === 'ready' && item.confirmedAt ? 'Подтверждено' : STATE_LABEL[item.state]}</Badge>
        {(item.state === 'draft' || item.state === 'blocked') && <Button size="sm" tone="danger" icon="trash-2" aria-label={`Убрать из очереди: ${entityName(item.entityId)}`} onClick={() => remove(item.id)} />}
      </li>
    })}</ul> : <EmptyState icon="upload" title="Очередь пуста" hint="Выберите сущность и назначение, чтобы подготовить публикацию." />}

    {history.length > 0 && <details className="improv-used"><summary>История отправок · {history.length}</summary><ul>{history.map((item) => <li key={item.id}>{entityName(item.entityId)} — {OPERATION_LABEL[item.operation].toLocaleLowerCase()} → {connectionName(item.connectionId)} <small>{item.completedAt ? new Date(item.completedAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</small>{item.result?.url && <> · <a href={item.result.url} target="_blank" rel="noreferrer">открыть</a></>}</li>)}</ul></details>}
  </section>
}
