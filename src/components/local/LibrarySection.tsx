import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, EmptyState, Icon } from '../../ds'
import { LibraryTable } from './LibraryTable'
import { EMPTY_FILTER, ENTITY_STATUS_LABEL, entityUsages, filterEntities, originLabel, usageCount, type EntityFilter } from '../../local/domain'
import { LibraryFilters } from './LibraryFilters'
import type { LocalCampaignEntity, LocalCampaignRecord } from '../../local/types'
import { ENTITY_LABEL, type SectionProps } from './shared'
import { EntityEditor } from './EntityEditor'
import { ImportDialog, SourceLinks } from './SourcePanels'
import { EntityDetails } from './EntityDetails'
import { PeekLink } from './Peek'

const STATUS_LABEL = ENTITY_STATUS_LABEL

export function LibrarySection({ campaign, persist }: SectionProps) {
  const [editor, setEditor] = useState<LocalCampaignEntity | 'new' | null>(null)
  const [filter, setFilter] = useState<EntityFilter>(EMPTY_FILTER)
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [params, setParams] = useSearchParams()
  const [importing, setImportingState] = useState(params.get('import') === '1')
  const setImporting = (value: boolean) => { setImportingState(value); if (!value && params.has('import')) setParams({}) }
  const openEditor = (entity: LocalCampaignEntity | 'new') => setEditor(entity)
  const visible = filterEntities(campaign.entities, filter, (entity) => usageCount(entityUsages(campaign, entity.id)))

  return <>
    <section className="campaign-section campaign-local-library"><div className="section-bar"><div><span className="panel-kicker">Мир</span><h2>Библиотека</h2></div><div className="row"><Button icon="download" onClick={() => setImporting(true)}>Из источника</Button><Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Новая сущность</Button></div></div>
      <LibraryFilters campaign={campaign} persist={persist} filter={filter} setFilter={setFilter} total={campaign.entities.filter((entity) => filter.showArchived || entity.status !== 'archived').length} shown={visible.length} extra={<div className="view-toggle" role="group" aria-label="Вид"><button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}><Icon name="layout-grid" size={15} /> Карточки</button><button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}><Icon name="table-2" size={15} /> Таблица</button></div>} />
      {view === 'table' && visible.length > 0 ? <LibraryTable campaign={campaign} persist={persist} entities={visible} sort={filter.sort ?? 'added'} setSort={(sort) => setFilter({ ...filter, sort })} /> : visible.length ? <div className="campaign-local-library__grid">{visible.map((entity) => <article key={entity.id} className={entity.status === 'archived' ? 'archived' : ''}><div className="row campaign-local-library__meta"><span className="panel-kicker">{ENTITY_LABEL[entity.type]}</span>{entity.status !== 'active' && <Badge size="sm" tone="neutral">{STATUS_LABEL[entity.status]}</Badge>}{entity.type === 'npc' && entity.dead && <Badge size="sm" tone="danger" icon="skull">Погиб</Badge>}<Badge size="sm" tone={entity.visibility === 'public' ? 'success' : 'warning'}>{entity.visibility === 'public' ? 'Для игроков' : 'Только ведущим'}</Badge></div><h3><PeekLink target={{ kind: 'entity', id: entity.id }}>{entity.name}</PeekLink></h3><p>{entity.description || 'Описание пока не добавлено.'}</p><EntityDetails entity={entity} className="campaign-local-library__fields" fate={false} /><small className="campaign-local-library__origin">{originLabel(entity, campaign)}</small><SourceLinks campaign={campaign} entity={entity} persist={persist} /><EntityUsagesList campaign={campaign} entityId={entity.id} persist={persist} /><footer><div>{entity.tags.map((tag) => <Badge size="sm" key={tag}>#{tag}</Badge>)}</div><div className="row">{entity.status === 'archived' ? <Button size="sm" onClick={() => persist({ ...campaign, entities: campaign.entities.map((item) => item.id === entity.id ? { ...item, status: 'active' } : item) })}>Вернуть</Button> : <Button size="sm" onClick={() => persist({ ...campaign, entities: campaign.entities.map((item) => item.id === entity.id ? { ...item, status: 'archived' } : item) })}>В архив</Button>}<Button size="sm" icon="pencil" aria-label={`Редактировать: ${entity.name}`} onClick={() => openEditor(entity)}>Редактировать</Button></div></footer></article>)}</div> : <EmptyState icon="library" title={campaign.entities.length ? 'Ничего не найдено' : 'Библиотека пока пуста'} hint={campaign.entities.length ? 'Измените поиск или фильтр. Архивные записи скрыты, пока не включён «Показать архив».' : 'Создайте первого персонажа, место или важный предмет.'} action={!campaign.entities.length ? <Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Создать сущность</Button> : undefined} />}</section>
    {importing && <ImportDialog campaign={campaign} persist={persist} close={() => setImporting(false)} />}
    {editor && <EntityEditor key={editor === 'new' ? 'new' : editor.id} campaign={campaign} persist={persist} entity={editor} defaultType={filter.type === 'all' ? 'npc' : filter.type} close={() => setEditor(null)} />}
  </>
}

/** "Where used": session plans (trashed ones marked), relations, clocks and secrets that point at the entity. */
function EntityUsagesList({ campaign, entityId, persist }: { campaign: LocalCampaignRecord; entityId: string; persist: SectionProps['persist'] }) {
  const navigate = useNavigate()
  const usages = entityUsages(campaign, entityId)
  const total = usageCount(usages)
  if (!total) return null
  const name = (id: string) => campaign.entities.find((entity) => entity.id === id)?.name ?? 'неизвестная запись'
  const openSession = (sessionId: string) => { persist({ ...campaign, activeSessionId: sessionId }); navigate(`/local/campaign/${campaign.id}/session`) }
  return <details className="campaign-local-library__usages"><summary>Где используется · {total}</summary><ul>
    {usages.plans.map((usage) => <li key={`${usage.sessionId}:${usage.itemId}`}>{usage.trashed ? <span>№{usage.sessionNumber} {usage.sessionTitle}{usage.sceneTitle ? ` · ${usage.sceneTitle}` : ''} <small>(сессия в корзине)</small></span> : <button type="button" onClick={() => openSession(usage.sessionId)}>№{usage.sessionNumber} {usage.sessionTitle}{usage.sceneTitle ? ` · ${usage.sceneTitle}` : ''}</button>}</li>)}
    {usages.relations.map((relation) => { const other = relation.fromId === entityId ? relation.toId : relation.fromId; return <li key={relation.id}>Связь: <PeekLink target={{ kind: 'entity', id: other }}>{name(other)}</PeekLink> · {relation.label || 'без подписи'}</li> })}
    {usages.clocks.map((clock) => <li key={clock.id}>Часы: <PeekLink target={{ kind: 'clock', id: clock.id }}>{clock.title}</PeekLink></li>)}
    {usages.secrets.map((secret) => <li key={secret.id}>Секрет: <PeekLink target={{ kind: 'secret', id: secret.id }}>{secret.title}</PeekLink></li>)}
  </ul></details>
}
