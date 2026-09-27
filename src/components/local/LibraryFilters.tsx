import { useState } from 'react'
import { Button, Icon, Select } from '../../ds'
import { EMPTY_FILTER, activeFilterCount, type EntityFilter, type SavedFilter } from '../../local/domain'
import { EXTERNAL_SYSTEMS } from '../../model/external'
import { useActing } from '../../local/actingContext'
import { SYSTEM_LABEL } from '../../local/integration'
import type { LocalCampaignRecord } from '../../local/types'
import { ENTITY_LABEL, ENTITY_TYPES, type Persist } from './shared'

const SORT_LABEL = { added: 'По порядку добавления', name: 'По названию', type: 'По типу', used: 'Чаще используемые' } as const
const VISIBILITY_LABEL = { master: 'Только ведущим', public: 'Для игроков' } as const
const STATUS_LABEL = { active: 'Активные', inactive: 'Неактивные' } as const

/**
 * Library search and filters (ТЗ-2, R5 A + D): query and type always in view;
 * tags, visibility, state, source and sorting in a panel; active conditions as
 * removable chips; personal saved sets of filters.
 */
export function LibraryFilters({ campaign, persist, filter, setFilter, total, shown, extra }: { campaign: LocalCampaignRecord; persist: Persist; filter: EntityFilter; setFilter: (next: EntityFilter) => void; total: number; shown: number; extra?: React.ReactNode }) {
  const acting = useActing(campaign)
  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState<string | null>(null)
  const typeCounts = campaign.entities.reduce<Record<string, number>>((counts, entity) => ({ ...counts, [entity.type]: (counts[entity.type] ?? 0) + (entity.status === 'archived' && !filter.showArchived ? 0 : 1) }), {})
  const tags = [...new Set(campaign.entities.flatMap((entity) => entity.tags))].sort((a, b) => a.localeCompare(b, 'ru'))
  const systems = EXTERNAL_SYSTEMS.filter((system) => campaign.entities.some((entity) => entity.sources.some((source) => source.system === system)))
  const saved = (campaign.savedFilters?.[acting.master.id] ?? []) as unknown as SavedFilter[]
  const setSaved = (next: SavedFilter[]) => persist({ ...campaign, savedFilters: { ...campaign.savedFilters, [acting.master.id]: next as unknown as NonNullable<LocalCampaignRecord['savedFilters']>[string] } })
  const count = activeFilterCount(filter)
  const chips: Array<{ label: string; clear: EntityFilter }> = [
    ...(filter.tags ?? []).map((tag) => ({ label: `#${tag}`, clear: { ...filter, tags: filter.tags!.filter((item) => item !== tag) } })),
    ...(filter.visibility && filter.visibility !== 'all' ? [{ label: VISIBILITY_LABEL[filter.visibility], clear: { ...filter, visibility: 'all' as const } }] : []),
    ...(filter.status && filter.status !== 'all' ? [{ label: STATUS_LABEL[filter.status], clear: { ...filter, status: 'all' as const } }] : []),
    ...(filter.source && filter.source !== 'all' ? [{ label: filter.source === 'none' ? 'Только здесь' : `Из: ${SYSTEM_LABEL[filter.source]}`, clear: { ...filter, source: 'all' as const } }] : []),
    ...(filter.fate && filter.fate !== 'all' ? [{ label: filter.fate === 'dead' ? 'Погибшие' : 'Живые', clear: { ...filter, fate: 'all' as const } }] : []),
    ...(filter.showArchived ? [{ label: 'С архивом', clear: { ...filter, showArchived: false } }] : []),
    ...(filter.imported ? [{ label: 'Из импорта', clear: { ...filter, imported: false } }] : []),
    ...(filter.missing ? [{ label: filter.missing === 'tags' ? 'Без тегов' : 'Без описания', clear: { ...filter, missing: undefined } }] : []),
  ]
  const saveCurrent = () => { const name = naming?.trim(); if (!name) return; setSaved([...saved, { id: `filter-${crypto.randomUUID()}`, name, filter }]); setNaming(null) }
  return <div className="library-filters">
    <div className="library-filters__row">
      <div className="campaign-local-library__search"><Icon name="search" size={17} /><input value={filter.query} aria-label="Поиск по библиотеке" placeholder="Найти по названию, описанию, тегу или полю…" onChange={(event) => setFilter({ ...filter, query: event.target.value })} /></div>
      <Select aria-label="Тип сущности" value={filter.type} onChange={(event) => setFilter({ ...filter, type: event.target.value as EntityFilter['type'], fate: 'all' })}><option value="all">Все типы</option>{ENTITY_TYPES.filter((item) => typeCounts[item.value]).map((item) => <option key={item.value} value={item.value}>{item.label} · {typeCounts[item.value]}</option>)}</Select>
      <Button icon="list-filter" aria-expanded={open} onClick={() => setOpen(!open)}>Фильтры{count ? ` · ${count}` : ''}</Button>
      <Select aria-label="Сортировка" value={filter.sort ?? 'added'} onChange={(event) => setFilter({ ...filter, sort: event.target.value as EntityFilter['sort'] })}>{Object.entries(SORT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      {extra}
    </div>
    {open && <div className="library-filters__panel" role="group" aria-label="Фильтры библиотеки">
      <fieldset><legend>Теги</legend>{tags.length ? <div className="library-filters__tags">{tags.map((tag) => { const on = filter.tags?.includes(tag); return <label key={tag} className={`home-chip${on ? ' on' : ''}`}><input type="checkbox" checked={Boolean(on)} onChange={() => setFilter({ ...filter, tags: on ? filter.tags!.filter((item) => item !== tag) : [...(filter.tags ?? []), tag] })} />#{tag}</label> })}</div> : <small className="muted">Тегов пока нет</small>}</fieldset>
      <label>Видимость<Select value={filter.visibility ?? 'all'} onChange={(event) => setFilter({ ...filter, visibility: event.target.value as EntityFilter['visibility'] })}><option value="all">Любая</option><option value="master">Только ведущим</option><option value="public">Для игроков</option></Select></label>
      <label>Состояние<Select value={filter.status ?? 'all'} onChange={(event) => setFilter({ ...filter, status: event.target.value as EntityFilter['status'] })}><option value="all">Любое</option><option value="active">Активные</option><option value="inactive">Неактивные</option></Select></label>
      <label>Источник<Select value={filter.source ?? 'all'} onChange={(event) => setFilter({ ...filter, source: event.target.value as EntityFilter['source'] })}><option value="all">Любой</option><option value="none">Только здесь</option>{systems.map((system) => <option key={system} value={system}>{SYSTEM_LABEL[system]}</option>)}</Select></label>
      {filter.type === 'npc' && <label>Судьба<Select aria-label="Судьба NPC" value={filter.fate ?? 'all'} onChange={(event) => setFilter({ ...filter, fate: event.target.value as NonNullable<EntityFilter['fate']> })}><option value="all">Живые и погибшие</option><option value="alive">Только живые</option><option value="dead">Только погибшие</option></Select></label>}
      <label className="library-filters__check"><input type="checkbox" checked={filter.showArchived} onChange={(event) => setFilter({ ...filter, showArchived: event.target.checked })} /> Показать архив ({campaign.entities.filter((entity) => entity.status === 'archived').length})</label>
    </div>}
    <div className="library-filters__status">
      <span className="muted">{shown === total ? `Записей: ${total}` : `Показано ${shown} из ${total}`}{filter.type !== 'all' ? ` · ${ENTITY_LABEL[filter.type]}` : ''}</span>
      {chips.map((chip) => <button key={chip.label} type="button" className="library-filters__chip" onClick={() => setFilter(chip.clear)} aria-label={`Убрать фильтр: ${chip.label}`}>{chip.label} <Icon name="x" size={12} /></button>)}
      {(chips.length > 0 || filter.query || filter.type !== 'all') && <button type="button" className="home-chips__reset" onClick={() => setFilter({ ...EMPTY_FILTER, sort: filter.sort })}>Сбросить</button>}
      <span className="library-filters__saved" role="group" aria-label="Мои подборки">
        {saved.map((item) => <span key={item.id} className="library-filters__preset"><button type="button" onClick={() => setFilter({ ...EMPTY_FILTER, ...item.filter })}><Icon name="bookmark" size={13} /> {item.name}</button><button type="button" aria-label={`Удалить подборку: ${item.name}`} onClick={() => setSaved(saved.filter((entry) => entry.id !== item.id))}><Icon name="x" size={12} /></button></span>)}
        {naming === null ? <button type="button" className="home-chips__reset" onClick={() => setNaming('')}>Сохранить подборку</button> : <form className="library-filters__name" onSubmit={(event) => { event.preventDefault(); saveCurrent() }}><input autoFocus aria-label="Название подборки" value={naming} placeholder="НПС для сессии 3" onChange={(event) => setNaming(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setNaming(null) }} /><Button size="sm" type="submit" disabled={!naming.trim()}>Сохранить</Button></form>}
      </span>
    </div>
  </div>
}
