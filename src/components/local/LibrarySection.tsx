import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, EmptyState, Tabs, TextField } from '../../ds'
import { LibraryTable } from './LibraryTable'
import { EMPTY_FILTER, entityUsages, newNote, filterEntities, originLabel, usageCount, type EntityFilter } from '../../local/domain'
import { LibraryFilters } from './LibraryFilters'
import type { LocalCampaignEntity, LocalCampaignRecord } from '../../local/types'
import type { SectionProps } from './shared'
import { EntityEditor } from './EntityEditor'
import { ImportDialog, SourceLinks } from './SourcePanels'
import { EntityDetails } from './EntityDetails'
import { PeekLink } from './Peek'
import { ENTITY_STATUS_LABEL, ENTITY_LABEL, VISIBILITY_LABEL } from '../../local/labels'

const STATUS_LABEL = ENTITY_STATUS_LABEL

/**
 * The library. `notes` turns it into the «Заметки» section (ТЗ-3, этап 14, В4):
 * the same records filtered to the «Заметка» type, with a quick field on top.
 */
export function LibrarySection({ campaign, persist, notes = false }: SectionProps & { notes?: boolean }) {
  const [editor, setEditor] = useState<LocalCampaignEntity | 'new' | null>(null)
  const [params, setParams] = useSearchParams()
  const [chosen, setChosen] = useState<EntityFilter>(() => { try { return { ...EMPTY_FILTER, ...JSON.parse(params.get('filter') ?? '{}') } } catch { return EMPTY_FILTER } })
  const filter: EntityFilter = notes ? { ...chosen, type: 'note' } : chosen
  const setFilter = (next: EntityFilter) => setChosen(notes ? { ...next, type: 'all' } : next)
  const [quick, setQuick] = useState('')
  const addQuick = () => { if (!quick.trim()) return; persist({ ...campaign, entities: [...campaign.entities, newNote(quick)] }); setQuick('') }
  const pool = notes ? campaign.entities.filter((entity) => entity.type === 'note') : campaign.entities
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [importing, setImportingState] = useState(params.get('import') === '1')
  const setImporting = (value: boolean) => { setImportingState(value); if (!value && params.has('import')) setParams({}) }
  const openEditor = (entity: LocalCampaignEntity | 'new') => setEditor(entity)
  const visible = filterEntities(campaign.entities, filter, (entity) => usageCount(entityUsages(campaign, entity.id)))

  return <>
    <section className={`campaign-section campaign-local-library${notes ? ' campaign-local-library--notes' : ''}`}>
      <div className="section-bar">
        <div><span className="panel-kicker">Мир</span><h2>{notes ? 'Заметки' : 'Библиотека'}</h2></div>
        <div className="row">
          {!notes && <Button icon="download" onClick={() => setImporting(true)}>Из источника</Button>}
          <Button variant="primary" icon="plus" onClick={() => openEditor('new')}>{notes ? 'Новая заметка' : 'Новая сущность'}</Button>
        </div>
      </div>
      {notes && <>
        <p className="muted">Заметки — записи библиотеки типа «Заметка»: их можно связывать, отправлять и находить поиском.</p>
        <div className="target-capture">
          <TextField
            aria-label="Новая заметка"
            value={quick}
            placeholder="Факт, слух, место — коротко…"
            onChange={(event) => setQuick(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') addQuick() }}
          />
          <Button icon="plus" disabled={!quick.trim()} onClick={addQuick}>Добавить</Button>
        </div>
      </>}
      <LibraryFilters campaign={campaign} persist={persist} filter={filter} setFilter={setFilter} lockType={notes} total={pool.filter((entity) => filter.showArchived || entity.status !== 'archived').length} shown={visible.length} extra={<Tabs
        className="campaign-tabs"
        aria-label="Вид"
        activeId={view}
        onSelect={(id) => setView(id === 'table' ? 'table' : 'cards')}
        tabs={[{ id: 'cards', label: 'Карточки', icon: 'layout-grid' }, { id: 'table', label: 'Таблица', icon: 'table-2' }]}
      />} />
      {view === 'table' && visible.length > 0 ? <LibraryTable campaign={campaign} persist={persist} entities={visible} sort={filter.sort ?? 'added'} setSort={(sort) => setFilter({ ...filter, sort })} /> : visible.length ? <div className="campaign-local-library__grid">{visible.map((entity) => <article key={entity.id} className={entity.status === 'archived' ? 'archived' : ''}><div className="row campaign-local-library__meta"><span className="panel-kicker">{ENTITY_LABEL[entity.type]}</span>{entity.status !== 'active' && <Badge size="sm" tone="neutral">{STATUS_LABEL[entity.status]}</Badge>}{entity.type === 'npc' && entity.dead && <Badge size="sm" tone="danger" icon="skull">Погиб</Badge>}<Badge size="sm" tone={entity.visibility === 'public' ? 'success' : 'warning'}>{VISIBILITY_LABEL[entity.visibility]}</Badge></div><h3><PeekLink target={{ kind: 'entity', id: entity.id }}>{entity.name}</PeekLink></h3>{(entity.description || entity.type !== 'note') && <p>{entity.description || 'Описание пока не добавлено.'}</p>}<EntityDetails entity={entity} className="campaign-local-library__fields" fate={false} /><small className="campaign-local-library__origin">{originLabel(entity, campaign)}</small><SourceLinks campaign={campaign} entity={entity} persist={persist} /><EntityUsagesList campaign={campaign} entityId={entity.id} /><footer><div>{entity.tags.map((tag) => <Badge size="sm" key={tag}>#{tag}</Badge>)}</div><div className="row">{entity.status === 'archived' ? <Button size="sm" onClick={() => persist({ ...campaign, entities: campaign.entities.map((item) => item.id === entity.id ? { ...item, status: 'active' } : item) })}>Вернуть</Button> : <Button size="sm" onClick={() => persist({ ...campaign, entities: campaign.entities.map((item) => item.id === entity.id ? { ...item, status: 'archived' } : item) })}>В архив</Button>}<Button size="sm" icon="pencil" aria-label={`Редактировать: ${entity.name}`} onClick={() => openEditor(entity)}>Редактировать</Button></div></footer></article>)}</div> : <EmptyState icon={notes ? 'book-open' : 'library'} title={pool.length ? 'Ничего не найдено' : notes ? 'Заметок пока нет' : 'Библиотека пока пуста'} hint={pool.length ? 'Измените поиск или фильтр. Архивные записи скрыты, пока не включён «Показать архив».' : notes ? 'Запишите первый факт, слух или место в поле выше.' : 'Создайте первого персонажа, место или важный предмет.'} action={!pool.length && !notes ? <Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Создать сущность</Button> : undefined} />}</section>
    {importing && <ImportDialog campaign={campaign} persist={persist} close={() => setImporting(false)} />}
    {editor && <EntityEditor key={editor === 'new' ? 'new' : editor.id} campaign={campaign} persist={persist} entity={editor} defaultType={filter.type === 'all' ? 'npc' : filter.type} close={() => setEditor(null)} />}
  </>
}

/** "Where used": session plans (trashed ones marked), relations, clocks and secrets that point at the entity. */
function EntityUsagesList({ campaign, entityId }: { campaign: LocalCampaignRecord; entityId: string }) {
  const navigate = useNavigate()
  const usages = entityUsages(campaign, entityId)
  const total = usageCount(usages)
  if (!total) return null
  const name = (id: string) => campaign.entities.find((entity) => entity.id === id)?.name ?? 'неизвестная запись'
  const openSession = (sessionId: string) => navigate(`/local/campaign/${campaign.id}/session?session=${encodeURIComponent(sessionId)}`)
  return <details className="campaign-local-library__usages"><summary>Где используется · {total}</summary><ul>
    {usages.plans.map((usage) => <li key={`${usage.sessionId}:${usage.itemId}`}>{usage.trashed ? <span>№{usage.sessionNumber} {usage.sessionTitle}{usage.sceneTitle ? ` · ${usage.sceneTitle}` : ''} <small>(сессия в корзине)</small></span> : <button type="button" onClick={() => openSession(usage.sessionId)}>№{usage.sessionNumber} {usage.sessionTitle}{usage.sceneTitle ? ` · ${usage.sceneTitle}` : ''}</button>}</li>)}
    {usages.relations.map((relation) => { const other = relation.fromId === entityId ? relation.toId : relation.fromId; return <li key={relation.id}>Связь: <PeekLink target={{ kind: 'entity', id: other }}>{name(other)}</PeekLink> · {relation.label || 'без подписи'}</li> })}
    {usages.clocks.map((clock) => <li key={clock.id}>Часы: <PeekLink target={{ kind: 'clock', id: clock.id }}>{clock.title}</PeekLink></li>)}
    {usages.secrets.map((secret) => <li key={secret.id}>Секрет: <PeekLink target={{ kind: 'secret', id: secret.id }}>{secret.title}</PeekLink></li>)}
  </ul></details>
}
