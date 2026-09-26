import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, EmptyState, Icon, Select } from '../../ds'
import { ENTITY_STATUS_LABEL, entityUsages, filterEntities, originLabel, usageCount, type EntityFilter } from '../../local/domain'
import type { LocalCampaignEntity, LocalCampaignRecord } from '../../local/types'
import { ENTITY_LABEL, ENTITY_TYPES, type SectionProps } from './shared'
import { EntityEditor } from './EntityEditor'
import { ImportDialog, SourceLinks } from './SourcePanels'
import { EntityDetails } from './EntityDetails'

const STATUS_LABEL = ENTITY_STATUS_LABEL

export function LibrarySection({ campaign, persist }: SectionProps) {
  const [editor, setEditor] = useState<LocalCampaignEntity | 'new' | null>(null)
  const [filter, setFilter] = useState<EntityFilter>({ query: '', type: 'all', showArchived: false, fate: 'all' })
  const [importing, setImporting] = useState(false)
  const openEditor = (entity: LocalCampaignEntity | 'new') => setEditor(entity)
  const visible = filterEntities(campaign.entities, filter)
  const archivedCount = campaign.entities.filter((entity) => entity.status === 'archived').length
  const typeCounts = campaign.entities.reduce<Record<string, number>>((counts, entity) => ({ ...counts, [entity.type]: (counts[entity.type] ?? 0) + (entity.status === 'archived' && !filter.showArchived ? 0 : 1) }), {})

  return <>
    <section className="campaign-section campaign-local-library"><div className="panel-heading"><div><span className="panel-kicker">Единый справочник</span><h2>Библиотека кампании</h2><p>Персонажи, места, фракции и материалы этой истории.</p></div><div className="row"><Button icon="download" onClick={() => setImporting(true)}>Из источника</Button><Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Новая сущность</Button></div></div>
      <div className="campaign-local-library__toolbar"><div className="campaign-local-library__search"><Icon name="search" size={17} /><input value={filter.query} aria-label="Поиск по библиотеке" placeholder="Найти по названию, тегу или полю…" onChange={(event) => setFilter({ ...filter, query: event.target.value })} /></div><Select aria-label="Тип сущности" value={filter.type} onChange={(event) => setFilter({ ...filter, type: event.target.value as EntityFilter['type'], fate: 'all' })}><option value="all">Все типы</option>{ENTITY_TYPES.filter((item) => typeCounts[item.value]).map((item) => <option key={item.value} value={item.value}>{item.label} · {typeCounts[item.value]}</option>)}</Select>{filter.type === 'npc' && <Select aria-label="Судьба NPC" value={filter.fate ?? 'all'} onChange={(event) => setFilter({ ...filter, fate: event.target.value as NonNullable<EntityFilter['fate']> })}><option value="all">Живые и погибшие</option><option value="alive">Только живые</option><option value="dead">Только погибшие</option></Select>}<label className="campaign-local-library__archive"><input type="checkbox" checked={filter.showArchived} onChange={(event) => setFilter({ ...filter, showArchived: event.target.checked })} /> Показать архив ({archivedCount})</label></div>
      {visible.length ? <div className="campaign-local-library__grid">{visible.map((entity) => <article key={entity.id} className={entity.status === 'archived' ? 'archived' : ''}><div className="row campaign-local-library__meta"><span className="panel-kicker">{ENTITY_LABEL[entity.type]}</span>{entity.status !== 'active' && <Badge size="sm" tone="neutral">{STATUS_LABEL[entity.status]}</Badge>}{entity.type === 'npc' && entity.dead && <Badge size="sm" tone="danger" icon="skull">Погиб</Badge>}<Badge size="sm" tone={entity.visibility === 'public' ? 'success' : 'warning'}>{entity.visibility === 'public' ? 'Для игроков' : 'Только ведущим'}</Badge></div><h3>{entity.name}</h3><p>{entity.description || 'Описание пока не добавлено.'}</p><EntityDetails entity={entity} className="campaign-local-library__fields" fate={false} /><small className="campaign-local-library__origin">{originLabel(entity, campaign)}</small><SourceLinks campaign={campaign} entity={entity} persist={persist} /><EntityUsagesList campaign={campaign} entityId={entity.id} persist={persist} /><footer><div>{entity.tags.map((tag) => <Badge size="sm" key={tag}>#{tag}</Badge>)}</div><div className="row">{entity.status === 'archived' ? <Button size="sm" onClick={() => persist({ ...campaign, entities: campaign.entities.map((item) => item.id === entity.id ? { ...item, status: 'active' } : item) })}>Вернуть</Button> : <Button size="sm" onClick={() => persist({ ...campaign, entities: campaign.entities.map((item) => item.id === entity.id ? { ...item, status: 'archived' } : item) })}>В архив</Button>}<Button size="sm" icon="pencil" aria-label={`Редактировать: ${entity.name}`} onClick={() => openEditor(entity)}>Редактировать</Button></div></footer></article>)}</div> : <EmptyState icon="library" title={campaign.entities.length ? 'Ничего не найдено' : 'Библиотека пока пуста'} hint={campaign.entities.length ? 'Измените поиск или фильтр. Архивные записи скрыты, пока не включён «Показать архив».' : 'Создайте первого персонажа, место или важный предмет.'} action={!campaign.entities.length ? <Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Создать сущность</Button> : undefined} />}</section>
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
    {usages.relations.map((relation) => <li key={relation.id}>Связь: {name(relation.fromId === entityId ? relation.toId : relation.fromId)} · {relation.label || 'без подписи'}</li>)}
    {usages.clocks.map((clock) => <li key={clock.id}>Часы: {clock.title}</li>)}
    {usages.secrets.map((secret) => <li key={secret.id}>Секрет: {secret.title}</li>)}
  </ul></details>
}
