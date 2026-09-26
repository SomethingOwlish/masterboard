import { useState } from 'react'
import { Badge, Button, EmptyState, Icon, Select } from '../../ds'
import { ENTITY_FIELDS, filterEntities, newEntity, originLabel, type EntityFilter } from '../../local/domain'
import type { LocalCampaignEntity, LocalCampaignEntityType } from '../../local/types'
import { ENTITY_LABEL, ENTITY_TYPES, Editor, type SectionProps } from './shared'

type Draft = Omit<LocalCampaignEntity, 'id'>
const STATUS_LABEL: Record<LocalCampaignEntity['status'], string> = { active: 'Активна', inactive: 'Неактивна', archived: 'В архиве' }

export function LibrarySection({ campaign, persist }: SectionProps) {
  const [editor, setEditor] = useState<LocalCampaignEntity | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(() => { const { id: _id, ...rest } = newEntity({ type: 'npc', name: '' }); return rest })
  const [filter, setFilter] = useState<EntityFilter>({ query: '', type: 'all', showArchived: false })
  const openEditor = (entity: LocalCampaignEntity | 'new') => { setEditor(entity); const { id: _id, ...rest } = entity === 'new' ? newEntity({ type: filter.type === 'all' ? 'npc' : filter.type, name: '' }) : entity; setDraft(rest) }
  const save = () => {
    if (!draft.name.trim() || !editor) return
    const fields = Object.fromEntries(ENTITY_FIELDS[draft.type].map((field) => [field.id, draft.fields[field.id]?.trim() ?? '']).filter(([, value]) => value))
    const entity: LocalCampaignEntity = { ...draft, name: draft.name.trim(), description: draft.description.trim(), fields, tags: draft.tags.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean), id: editor === 'new' ? `entity-${crypto.randomUUID()}` : editor.id }
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
    <section className="campaign-section campaign-local-library"><div className="panel-heading"><div><span className="panel-kicker">Единый справочник</span><h2>Библиотека кампании</h2><p>Персонажи, места, фракции и материалы этой истории.</p></div><Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Новая сущность</Button></div>
      <div className="campaign-local-library__toolbar"><div className="campaign-local-library__search"><Icon name="search" size={17} /><input value={filter.query} aria-label="Поиск по библиотеке" placeholder="Найти по названию, тегу или полю…" onChange={(event) => setFilter({ ...filter, query: event.target.value })} /></div><Select aria-label="Тип сущности" value={filter.type} onChange={(event) => setFilter({ ...filter, type: event.target.value as EntityFilter['type'] })}><option value="all">Все типы</option>{ENTITY_TYPES.filter((item) => typeCounts[item.value]).map((item) => <option key={item.value} value={item.value}>{item.label} · {typeCounts[item.value]}</option>)}</Select><label className="campaign-local-library__archive"><input type="checkbox" checked={filter.showArchived} onChange={(event) => setFilter({ ...filter, showArchived: event.target.checked })} /> Показать архив ({archivedCount})</label></div>
      {visible.length ? <div className="campaign-local-library__grid">{visible.map((entity) => <article key={entity.id} className={entity.status === 'archived' ? 'archived' : ''}><div className="row campaign-local-library__meta"><span className="panel-kicker">{ENTITY_LABEL[entity.type]}</span>{entity.status !== 'active' && <Badge size="sm" tone="neutral">{STATUS_LABEL[entity.status]}</Badge>}<Badge size="sm" tone={entity.visibility === 'public' ? 'success' : 'warning'}>{entity.visibility === 'public' ? 'Для игроков' : 'Только ведущим'}</Badge></div><h3>{entity.name}</h3><p>{entity.description || 'Описание пока не добавлено.'}</p>{ENTITY_FIELDS[entity.type].some((field) => entity.fields[field.id]) && <dl className="campaign-local-library__fields">{ENTITY_FIELDS[entity.type].filter((field) => entity.fields[field.id]).map((field) => <div key={field.id}><dt>{field.label}</dt><dd>{entity.fields[field.id]}</dd></div>)}</dl>}<small className="campaign-local-library__origin">{originLabel(entity, campaign)}</small><footer><div>{entity.tags.map((tag) => <Badge size="sm" key={tag}>#{tag}</Badge>)}</div><div className="row">{entity.status === 'archived' ? <Button size="sm" onClick={() => persist({ ...campaign, entities: campaign.entities.map((item) => item.id === entity.id ? { ...item, status: 'active' } : item) })}>Вернуть</Button> : <Button size="sm" onClick={() => persist({ ...campaign, entities: campaign.entities.map((item) => item.id === entity.id ? { ...item, status: 'archived' } : item) })}>В архив</Button>}<Button size="sm" icon="pencil" aria-label={`Редактировать: ${entity.name}`} onClick={() => openEditor(entity)}>Редактировать</Button></div></footer></article>)}</div> : <EmptyState icon="library" title={campaign.entities.length ? 'Ничего не найдено' : 'Библиотека пока пуста'} hint={campaign.entities.length ? 'Измените поиск или фильтр. Архивные записи скрыты, пока не включён «Показать архив».' : 'Создайте первого персонажа, место или важный предмет.'} action={!campaign.entities.length ? <Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Создать сущность</Button> : undefined} />}</section>
    {editor && <Editor title={editor === 'new' ? 'Новая сущность' : 'Редактировать сущность'} close={() => setEditor(null)}>
      <div className="control-form__row"><label htmlFor="local-entity-type">Тип<Select id="local-entity-type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as LocalCampaignEntityType })}>{ENTITY_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label><label htmlFor="local-entity-name">Название<input id="local-entity-name" autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label></div>
      <label htmlFor="local-entity-description">Рабочее описание<textarea id="local-entity-description" rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      {ENTITY_FIELDS[draft.type].length > 0 && <div className="control-form__row">{ENTITY_FIELDS[draft.type].map((field) => <label key={field.id} htmlFor={`local-entity-field-${field.id}`}>{field.label}<input id={`local-entity-field-${field.id}`} value={draft.fields[field.id] ?? ''} onChange={(event) => setDraft({ ...draft, fields: { ...draft.fields, [field.id]: event.target.value } })} /></label>)}</div>}
      <label htmlFor="local-entity-tags">Теги<input id="local-entity-tags" value={draft.tags.join(', ')} placeholder="важное, первая сессия" onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(',') })} /></label>
      <div className="control-form__row"><label htmlFor="local-entity-visibility">Видимость<select id="local-entity-visibility" value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as LocalCampaignEntity['visibility'] })}><option value="master">Только ведущим</option><option value="public">Для игроков</option></select></label><label htmlFor="local-entity-status">Состояние<select id="local-entity-status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as LocalCampaignEntity['status'] })}>{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <footer>{editor !== 'new' && <Button tone="danger" onClick={() => { remove(editor.id); setEditor(null) }}>Удалить</Button>}<Button onClick={() => setEditor(null)}>Отмена</Button><Button variant="primary" icon="check" disabled={!draft.name.trim()} onClick={save}>Сохранить</Button></footer>
    </Editor>}
  </>
}
