import { useState } from 'react'
import { Badge, Button, EmptyState, Icon, Select } from '../../ds'
import type { LocalCampaignEntity, LocalCampaignEntityType } from '../../local/types'
import { ENTITY_LABEL, ENTITY_TYPES, Editor, type SectionProps } from './shared'

type Draft = Omit<LocalCampaignEntity, 'id'>
const EMPTY: Draft = { type: 'npc', name: '', description: '', tags: [], visibility: 'master', status: 'active' }

export function LibrarySection({ campaign, persist }: SectionProps) {
  const [editor, setEditor] = useState<LocalCampaignEntity | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [query, setQuery] = useState('')
  const openEditor = (entity: LocalCampaignEntity | 'new') => { setEditor(entity); setDraft(entity === 'new' ? EMPTY : { type: entity.type, name: entity.name, description: entity.description, tags: entity.tags, visibility: entity.visibility, status: entity.status }) }
  const save = () => {
    if (!draft.name.trim() || !editor) return
    const entity: LocalCampaignEntity = { ...draft, name: draft.name.trim(), description: draft.description.trim(), tags: draft.tags.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean), id: editor === 'new' ? `entity-${crypto.randomUUID()}` : editor.id }
    persist({ ...campaign, entities: editor === 'new' ? [...campaign.entities, entity] : campaign.entities.map((item) => item.id === entity.id ? entity : item) })
    setEditor(null)
  }
  const visible = campaign.entities.filter((entity) => !query.trim() || `${entity.name} ${entity.tags.join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))

  return <>
    <section className="campaign-section campaign-local-library"><div className="panel-heading"><div><span className="panel-kicker">Единый справочник</span><h2>Библиотека кампании</h2><p>Персонажи, места, фракции и материалы этой истории.</p></div><Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Новая сущность</Button></div><div className="campaign-local-library__search"><Icon name="search" size={17} /><input value={query} aria-label="Поиск по библиотеке" placeholder="Найти по названию или тегу…" onChange={(event) => setQuery(event.target.value)} /></div>{visible.length ? <div className="campaign-local-library__grid">{visible.map((entity) => <article key={entity.id}><span className="panel-kicker">{ENTITY_LABEL[entity.type]}</span><h3>{entity.name}</h3><p>{entity.description || 'Описание пока не добавлено.'}</p><footer><div>{entity.tags.map((tag) => <Badge size="sm" key={tag}>#{tag}</Badge>)}</div><Button size="sm" icon="pencil" onClick={() => openEditor(entity)}>Редактировать</Button></footer></article>)}</div> : <EmptyState icon="library" title={campaign.entities.length ? 'Ничего не найдено' : 'Библиотека пока пуста'} hint={campaign.entities.length ? 'Измените поисковый запрос.' : 'Создайте первого персонажа, место или важный предмет.'} action={!campaign.entities.length ? <Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Создать сущность</Button> : undefined} />}</section>
    {editor && <Editor title={editor === 'new' ? 'Новая сущность' : 'Редактировать сущность'} close={() => setEditor(null)}><label htmlFor="local-entity-type">Тип<Select id="local-entity-type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as LocalCampaignEntityType })}>{ENTITY_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label><label htmlFor="local-entity-name">Название<input id="local-entity-name" autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label htmlFor="local-entity-description">Рабочее описание<textarea id="local-entity-description" rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><label htmlFor="local-entity-tags">Теги<input id="local-entity-tags" value={draft.tags.join(', ')} placeholder="важное, первая сессия" onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(',') })} /></label><footer>{editor !== 'new' && <Button tone="danger" onClick={() => { persist({ ...campaign, entities: campaign.entities.filter((item) => item.id !== editor.id), relations: campaign.relations.filter((relation) => relation.fromId !== editor.id && relation.toId !== editor.id) }); setEditor(null) }}>Удалить</Button>}<Button onClick={() => setEditor(null)}>Отмена</Button><Button variant="primary" icon="check" disabled={!draft.name.trim()} onClick={save}>Сохранить</Button></footer></Editor>}
  </>
}
