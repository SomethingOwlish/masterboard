import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Icon } from '../ds'
import { localStoryMapDemo } from '../fixtures/localDemoRuntime'
import type { StoryMapSnapshot, StoryVisibility } from '../fixtures/localStoryMapDemo'

const kindLabel = { character: 'Герой', npc: 'Персонаж ведущего', faction: 'Фракция', location: 'Место' }

export function LocalStoryMapPage() {
  const demo = useMemo(() => localStoryMapDemo, [])
  const [map, setMap] = useState<StoryMapSnapshot>(() => demo.load())
  const [selectedId, setSelectedId] = useState('fox')
  const [visibility, setVisibility] = useState<'all' | StoryVisibility>('all')
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ from: 'bryn', to: 'fox', label: '', visibility: 'master' as StoryVisibility })
  const selected = map.entities.find((item) => item.id === selectedId) ?? map.entities[0]
  const visibleRelations = map.relations.filter((item) => visibility === 'all' || item.visibility === visibility)
  const connected = visibleRelations.filter((item) => item.from === selected.id || item.to === selected.id)
  const relevantEvents = map.events.filter((item) => item.entityIds.includes(selected.id))
  useEffect(() => { if (!adding) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setAdding(false) }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [adding])
  const entity = (id: string) => map.entities.find((item) => item.id === id)!

  const submit = () => {
    try { setMap(demo.addRelation(draft)); setDraft((value) => ({ ...value, label: '' })); setAdding(false); setSelectedId(draft.from) } catch { /* disabled controls prevent invalid input */ }
  }

  return <main className="story-map">
    <header className="story-map__topbar">
      <nav><Link to="/demo/campaign"><Icon name="arrow-left" size={16} /> Кампания</Link><Link to="/demo/library"><Icon name="library" size={16} /> Библиотека</Link></nav>
      <Badge tone="neutral" dot>Локальные тестовые данные</Badge>
    </header>

    <section className="story-map__heading">
      <div><span className="panel-kicker">Лунный порт · карта ведущего</span><h1>Связи и хронология</h1><p>Одна точка обзора для людей, мест, фракций и событий кампании.</p></div>
      <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Добавить связь</Button>
    </section>

    <section className="story-map__toolbar" aria-label="Фильтры карты">
      <div><span>Видимость</span>{([['all', 'Все'], ['public', 'Для игроков'], ['master', 'Только ведущим']] as const).map(([value, label]) => <button className={visibility === value ? 'active' : ''} key={value} onClick={() => setVisibility(value)}>{label}</button>)}</div>
      <small>{visibleRelations.length} связей · выбрано: <strong>{selected.name}</strong></small>
    </section>

    <div className="story-map__workspace">
      <section className="story-map__canvas" aria-label="Карта связей">
        <div className="story-map__threads" aria-hidden="true">
          {visibleRelations.map((relation) => { const from = entity(relation.from); const to = entity(relation.to); const active = relation.from === selected.id || relation.to === selected.id; return <svg key={relation.id} className={active ? 'active' : ''}><line x1={`${from.x}%`} y1={`${from.y}%`} x2={`${to.x}%`} y2={`${to.y}%`} /></svg> })}
        </div>
        {map.entities.map((item) => <button key={item.id} className={`story-node story-node--${item.kind} ${item.id === selected.id ? 'selected' : ''}`} style={{ left: `${item.x}%`, top: `${item.y}%` }} onClick={() => setSelectedId(item.id)} aria-pressed={item.id === selected.id}><span>{kindLabel[item.kind]}</span><strong>{item.name}</strong><small>{item.subtitle}</small></button>)}
        <div className="story-map__mobile-list">
          {map.entities.map((item) => <button key={item.id} className={item.id === selected.id ? 'selected' : ''} onClick={() => setSelectedId(item.id)}><i className={`entity-mark entity-mark--${item.kind}`} /><span><small>{kindLabel[item.kind]}</small><strong>{item.name}</strong></span><Icon name="chevron-right" size={16} /></button>)}
        </div>
      </section>

      <aside className="story-map__inspector">
        <span className="panel-kicker">{kindLabel[selected.kind]}</span><h2>{selected.name}</h2><p>{selected.subtitle}</p>
        <div className="story-map__inspector-title"><strong>Прямые связи</strong><span>{connected.length}</span></div>
        <div className="story-map__relations">{connected.length ? connected.map((relation) => { const other = entity(relation.from === selected.id ? relation.to : relation.from); return <article key={relation.id}><button onClick={() => setSelectedId(other.id)}><strong>{other.name}</strong><span>{relation.from === selected.id ? '→' : '←'} {relation.label}</span></button><button aria-label="Изменить видимость" title="Изменить видимость" onClick={() => setMap(demo.toggleRelationVisibility(relation.id))}><Icon name={relation.visibility === 'master' ? 'eye-off' : 'eye'} size={15} /></button></article> }) : <p className="muted">Нет связей с таким уровнем видимости.</p>}</div>
        <div className="story-map__legend"><span><i className="entity-mark entity-mark--character" /> Герой</span><span><i className="entity-mark entity-mark--npc" /> Персонаж ведущего</span><span><i className="entity-mark entity-mark--faction" /> Фракция</span><span><i className="entity-mark entity-mark--location" /> Место</span></div>
      </aside>
    </div>

    <section className="story-map__chronology">
      <div className="panel-heading"><div><span className="panel-kicker">Лента событий</span><h2>Хронология кампании</h2></div><span className="panel-state">{relevantEvents.length} связано с выбранным</span></div>
      <div className="story-timeline">{map.events.map((event, index) => { const relevant = event.entityIds.includes(selected.id); return <article key={event.id} className={relevant ? 'relevant' : ''}><div><span>{event.date}</span><i>{index + 1}</i></div><h3>{event.title}</h3><p>{event.summary}</p><footer>{event.entityIds.map((id) => <button key={id} onClick={() => setSelectedId(id)}>{entity(id).name}</button>)}{event.visibility === 'master' && <Icon name="eye-off" size={14} />}</footer></article> })}</div>
    </section>

    {adding && <div className="story-map__scrim" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setAdding(false) }}><section className="story-map__dialog" role="dialog" aria-modal="true" aria-labelledby="relation-title"><span className="panel-kicker">Нить на карте</span><h2 id="relation-title">Новая связь</h2><div className="story-map__form-row"><label htmlFor="relation-from">От<select id="relation-from" name="relation-from" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })}>{map.entities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label htmlFor="relation-to">К кому<select id="relation-to" name="relation-to" value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })}>{map.entities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><label htmlFor="relation-label">Смысл связи<input id="relation-label" name="relation-label" autoFocus value={draft.label} placeholder="например: не доверяет" onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></label><label htmlFor="relation-visibility">Видимость<select id="relation-visibility" name="relation-visibility" value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as StoryVisibility })}><option value="master">Только ведущим</option><option value="public">Для игроков</option></select></label><footer><Button variant="ghost" onClick={() => setAdding(false)}>Отмена</Button><Button variant="primary" disabled={!draft.label.trim() || draft.from === draft.to} onClick={submit}>Добавить связь</Button></footer></section></div>}
    <p className="local-session-footnote">Изменения хранятся только в этой вкладке. Перезагрузка вернёт исходные тестовые данные.</p>
  </main>
}
