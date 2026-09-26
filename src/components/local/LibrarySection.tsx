import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, EmptyState, Icon, Select } from '../../ds'
import { ENTITY_FIELDS, entityUsages, filterEntities, newEntity, originLabel, usageCount, type EntityFilter } from '../../local/domain'
import type { LocalCampaignEntity, LocalCampaignEntityType, LocalCampaignRecord } from '../../local/types'
import { ENTITY_LABEL, ENTITY_TYPES, Editor, type SectionProps } from './shared'
import { ImportDialog, SourceLinks } from './SourcePanels'

type Draft = Omit<LocalCampaignEntity, 'id'>
const STATUS_LABEL: Record<LocalCampaignEntity['status'], string> = { active: 'Активна', inactive: 'Неактивна', archived: 'В архиве' }

export function LibrarySection({ campaign, persist }: SectionProps) {
  const [editor, setEditor] = useState<LocalCampaignEntity | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(() => { const { id: _id, ...rest } = newEntity({ type: 'npc', name: '' }); return rest })
  const [filter, setFilter] = useState<EntityFilter>({ query: '', type: 'all', showArchived: false, fate: 'all' })
  const [importing, setImporting] = useState(false)
  /** Fields from another system that have no slot in this type keep their label as the key; they are shown but not edited here. */
  const extraFields = (entity: Pick<LocalCampaignEntity, 'type' | 'fields'>) => Object.entries(entity.fields).filter(([key, value]) => value && !ENTITY_FIELDS[entity.type].some((field) => field.id === key))
  const openEditor = (entity: LocalCampaignEntity | 'new') => { setEditor(entity); const { id: _id, ...rest } = entity === 'new' ? newEntity({ type: filter.type === 'all' ? 'npc' : filter.type, name: '' }) : entity; setDraft(rest) }
  const save = () => {
    if (!draft.name.trim() || !editor) return
    const fields = Object.fromEntries([...ENTITY_FIELDS[draft.type].map((field) => [field.id, draft.fields[field.id]?.trim() ?? '']), ...extraFields(draft)].filter(([, value]) => value))
    const { dead: _dead, ...rest } = draft
    const entity: LocalCampaignEntity = { ...rest, ...(draft.type === 'npc' && draft.dead ? { dead: true } : {}), name: draft.name.trim(), description: draft.description.trim(), fields, tags: draft.tags.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean), id: editor === 'new' ? `entity-${crypto.randomUUID()}` : editor.id }
    persist({ ...campaign, entities: editor === 'new' ? [...campaign.entities, entity] : campaign.entities.map((item) => item.id === entity.id ? entity : item) })
    setEditor(null)
  }
  const remove = (id: string) => persist({
    ...campaign,
    entities: campaign.entities.filter((item) => item.id !== id),
    relations: campaign.relations.filter((relation) => relation.fromId !== id && relation.toId !== id),
    clocks: campaign.clocks.map((clock) => ({ ...clock, entityIds: clock.entityIds.filter((item) => item !== id) })),
    secrets: campaign.secrets.map((secret) => ({ ...secret, entityIds: secret.entityIds.filter((item) => item !== id) })),
  })
  const visible = filterEntities(campaign.entities, filter)
  const archivedCount = campaign.entities.filter((entity) => entity.status === 'archived').length
  const typeCounts = campaign.entities.reduce<Record<string, number>>((counts, entity) => ({ ...counts, [entity.type]: (counts[entity.type] ?? 0) + (entity.status === 'archived' && !filter.showArchived ? 0 : 1) }), {})

  return <>
    <section className="campaign-section campaign-local-library"><div className="panel-heading"><div><span className="panel-kicker">Единый справочник</span><h2>Библиотека кампании</h2><p>Персонажи, места, фракции и материалы этой истории.</p></div><div className="row"><Button icon="download" onClick={() => setImporting(true)}>Из источника</Button><Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Новая сущность</Button></div></div>
      <div className="campaign-local-library__toolbar"><div className="campaign-local-library__search"><Icon name="search" size={17} /><input value={filter.query} aria-label="Поиск по библиотеке" placeholder="Найти по названию, тегу или полю…" onChange={(event) => setFilter({ ...filter, query: event.target.value })} /></div><Select aria-label="Тип сущности" value={filter.type} onChange={(event) => setFilter({ ...filter, type: event.target.value as EntityFilter['type'], fate: 'all' })}><option value="all">Все типы</option>{ENTITY_TYPES.filter((item) => typeCounts[item.value]).map((item) => <option key={item.value} value={item.value}>{item.label} · {typeCounts[item.value]}</option>)}</Select>{filter.type === 'npc' && <Select aria-label="Судьба NPC" value={filter.fate ?? 'all'} onChange={(event) => setFilter({ ...filter, fate: event.target.value as NonNullable<EntityFilter['fate']> })}><option value="all">Живые и погибшие</option><option value="alive">Только живые</option><option value="dead">Только погибшие</option></Select>}<label className="campaign-local-library__archive"><input type="checkbox" checked={filter.showArchived} onChange={(event) => setFilter({ ...filter, showArchived: event.target.checked })} /> Показать архив ({archivedCount})</label></div>
      {visible.length ? <div className="campaign-local-library__grid">{visible.map((entity) => <article key={entity.id} className={entity.status === 'archived' ? 'archived' : ''}><div className="row campaign-local-library__meta"><span className="panel-kicker">{ENTITY_LABEL[entity.type]}</span>{entity.status !== 'active' && <Badge size="sm" tone="neutral">{STATUS_LABEL[entity.status]}</Badge>}{entity.type === 'npc' && entity.dead && <Badge size="sm" tone="danger" icon="skull">Погиб</Badge>}<Badge size="sm" tone={entity.visibility === 'public' ? 'success' : 'warning'}>{entity.visibility === 'public' ? 'Для игроков' : 'Только ведущим'}</Badge></div><h3>{entity.name}</h3><p>{entity.description || 'Описание пока не добавлено.'}</p>{ENTITY_FIELDS[entity.type].some((field) => entity.fields[field.id]) && <dl className="campaign-local-library__fields">{ENTITY_FIELDS[entity.type].filter((field) => entity.fields[field.id]).map((field) => <div key={field.id}><dt>{field.label}</dt><dd>{entity.fields[field.id]}</dd></div>)}</dl>}{extraFields(entity).length > 0 && <dl className="campaign-local-library__fields">{extraFields(entity).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}<small className="campaign-local-library__origin">{originLabel(entity, campaign)}</small><SourceLinks campaign={campaign} entity={entity} persist={persist} /><EntityUsagesList campaign={campaign} entityId={entity.id} persist={persist} /><footer><div>{entity.tags.map((tag) => <Badge size="sm" key={tag}>#{tag}</Badge>)}</div><div className="row">{entity.status === 'archived' ? <Button size="sm" onClick={() => persist({ ...campaign, entities: campaign.entities.map((item) => item.id === entity.id ? { ...item, status: 'active' } : item) })}>Вернуть</Button> : <Button size="sm" onClick={() => persist({ ...campaign, entities: campaign.entities.map((item) => item.id === entity.id ? { ...item, status: 'archived' } : item) })}>В архив</Button>}<Button size="sm" icon="pencil" aria-label={`Редактировать: ${entity.name}`} onClick={() => openEditor(entity)}>Редактировать</Button></div></footer></article>)}</div> : <EmptyState icon="library" title={campaign.entities.length ? 'Ничего не найдено' : 'Библиотека пока пуста'} hint={campaign.entities.length ? 'Измените поиск или фильтр. Архивные записи скрыты, пока не включён «Показать архив».' : 'Создайте первого персонажа, место или важный предмет.'} action={!campaign.entities.length ? <Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Создать сущность</Button> : undefined} />}</section>
    {importing && <ImportDialog campaign={campaign} persist={persist} close={() => setImporting(false)} />}
    {editor && <Editor title={editor === 'new' ? 'Новая сущность' : 'Редактировать сущность'} close={() => setEditor(null)}>
      <div className="control-form__row"><label htmlFor="local-entity-type">Тип<Select id="local-entity-type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as LocalCampaignEntityType })}>{ENTITY_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label><label htmlFor="local-entity-name">Название<input id="local-entity-name" autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label></div>
      <label htmlFor="local-entity-description">Рабочее описание<textarea id="local-entity-description" rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      {ENTITY_FIELDS[draft.type].length > 0 && <div className="control-form__row">{ENTITY_FIELDS[draft.type].map((field) => <label key={field.id} htmlFor={`local-entity-field-${field.id}`}>{field.label}<input id={`local-entity-field-${field.id}`} value={draft.fields[field.id] ?? ''} onChange={(event) => setDraft({ ...draft, fields: { ...draft.fields, [field.id]: event.target.value } })} /></label>)}</div>}
      <label htmlFor="local-entity-tags">Теги<input id="local-entity-tags" value={draft.tags.join(', ')} placeholder="важное, первая сессия" onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(',') })} /></label>
      <div className="control-form__row"><label htmlFor="local-entity-visibility">Видимость<select id="local-entity-visibility" value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as LocalCampaignEntity['visibility'] })}><option value="master">Только ведущим</option><option value="public">Для игроков</option></select></label><label htmlFor="local-entity-status">Состояние<select id="local-entity-status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as LocalCampaignEntity['status'] })}>{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      {draft.type === 'npc' && <label className="campaign-local-library__dead"><input type="checkbox" checked={Boolean(draft.dead)} onChange={(event) => setDraft({ ...draft, dead: event.target.checked })} /> Персонаж погиб</label>}
      <footer>{editor !== 'new' && (() => { const planned = entityUsages(campaign, editor.id).plans.length; const hint = planned ? `Используется в планах сессий (${planned}) — уберите из планов или отправьте в архив` : undefined; return <Button tone="danger" disabled={planned > 0} title={hint} onClick={() => { remove(editor.id); setEditor(null) }}>Удалить</Button> })()}<Button onClick={() => setEditor(null)}>Отмена</Button><Button variant="primary" icon="check" disabled={!draft.name.trim()} onClick={save}>Сохранить</Button></footer>
    </Editor>}
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
