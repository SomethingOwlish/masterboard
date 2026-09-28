import { useState } from 'react'
import { Button, Icon, Select } from '../../../ds'
import type { LocalSessionPlanItem, LocalSessionPlanKind } from '../../../local/types'
import { SessionModal } from '../shared'
import { DRAG_SOURCE, type LinkedSource, type PlanApi, type PlanTarget } from './planApi'
import { ENTITY_LABEL, PLAN_KINDS, PRIORITIES } from '../../../local/labels'

type Priority = LocalSessionPlanItem['priority']
const LOOSE = '__loose'
const key = (source: LinkedSource) => `${source.type}:${source.id}`

/** Library records and secrets not yet in this session, matching the search. */
function available(api: PlanApi, query: string) {
  const linked = new Set(api.session.planItems.flatMap((item) => [item.entityId, item.secretId].filter((id): id is string => Boolean(id))))
  const q = query.trim().toLocaleLowerCase()
  const entities = api.campaign.entities.filter((entity) => entity.status !== 'archived' && !linked.has(entity.id) && `${entity.name} ${entity.tags.join(' ')} ${ENTITY_LABEL[entity.type]}`.toLocaleLowerCase().includes(q))
  const secrets = api.campaign.secrets.filter((secret) => !linked.has(secret.id) && `${secret.title} ${secret.truth}`.toLocaleLowerCase().includes(q))
  return { entities, secrets }
}

function TargetSelect({ api, label, value, onChange, placeholder }: { api: PlanApi; label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const scenes = api.session.planItems.filter((item) => item.kind === 'scene')
  return <Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{placeholder !== undefined && <option value="">{placeholder}</option>}<option value={LOOSE}>Вне сцен</option>{scenes.map((scene) => <option key={scene.id} value={scene.id}>{api.itemTitle(scene)}</option>)}</Select>
}
const toTarget = (value: string): PlanTarget => value && value !== LOOSE ? value : null

/**
 * Slide-out panel next to the plan: create items from free text and take
 * library records or secrets — drag them into a scene or outside scenes, or
 * pick where with «+ в план…». The board stays visible while it is open.
 */
export function PlanAddPanel({ api, close }: { api: PlanApi; close: () => void }) {
  const [kind, setKind] = useState<LocalSessionPlanKind>('scene')
  const [priority, setPriority] = useState<Priority>('desired')
  const [where, setWhere] = useState(LOOSE)
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const { entities, secrets } = available(api, query)
  const add = () => { const value = text.trim(); if (!value) return; api.addText(value, kind, priority, kind === 'scene' ? null : toTarget(where)); setText('') }
  const entry = (source: LinkedSource, kicker: string, title: string, hint: string) => <li key={key(source)} draggable onDragStart={(event) => { event.dataTransfer.setData(DRAG_SOURCE, key(source)); event.dataTransfer.effectAllowed = 'copy' }}>
    <div><span className="panel-kicker">{kicker}</span><strong>{title}</strong>{hint && <small>{hint}</small>}</div>
    <TargetSelect api={api} label={`Добавить ${title}`} value="" placeholder="+ в план…" onChange={(value) => value && api.addLinked([source], toTarget(value), priority)} />
  </li>

  return <aside className="plan-add-panel" aria-label="Добавить в план">
    <header><h2>Добавить в план</h2><Button size="sm" icon="x" aria-label="Закрыть панель добавления" onClick={close} /></header>
    <form className="plan-add-panel__new" onSubmit={(event) => { event.preventDefault(); add() }}>
      <h3>Новый пункт</h3>
      <div className="plan-add-panel__row"><Select aria-label="Тип пункта плана" value={kind} onChange={(event) => setKind(event.target.value as LocalSessionPlanKind)}>{PLAN_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><Select aria-label="Приоритет пункта" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>{PRIORITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
      {kind !== 'scene' && <TargetSelect api={api} label="Куда добавить пункт" value={where} onChange={setWhere} />}
      <input aria-label="Свободный текст пункта плана" value={text} placeholder={kind === 'scene' ? 'Название сцены…' : 'Идея, вопрос, событие или любой текст…'} onChange={(event) => setText(event.target.value)} />
      <Button type="submit" variant="primary" icon="plus" disabled={!text.trim()}>Добавить текстом</Button>
    </form>
    <section className="plan-add-panel__library" aria-label="Библиотека и секреты">
      <h3>Библиотека и секреты</h3>
      <p className="muted">Перетащите запись в сцену или в «Вне сцен», либо выберите «+ в план…». Приоритет — как у нового пункта выше.</p>
      <input aria-label="Поиск в панели добавления" value={query} placeholder="Название, тег или тип…" onChange={(event) => setQuery(event.target.value)} />
      <ul>
        {entities.map((entity) => entry({ type: 'entity', id: entity.id }, ENTITY_LABEL[entity.type], entity.name, entity.description))}
        {secrets.map((secret) => entry({ type: 'secret', id: secret.id }, 'Секрет', secret.title, secret.revealCondition ? `Раскрыть: ${secret.revealCondition}` : secret.truth))}
      </ul>
      {!entities.length && !secrets.length && <p className="muted">{query ? 'Ничего не найдено.' : 'Всё из библиотеки и секретов уже в плане или ещё не создано.'}</p>}
    </section>
  </aside>
}

/**
 * «Из библиотеки»: pick several records and secrets at once and put them
 * straight into a scene (preselected when opened from a scene) or outside scenes.
 */
export function LibraryPicker({ api, target, close }: { api: PlanApi; target: PlanTarget; close: () => void }) {
  const [where, setWhere] = useState(target ?? LOOSE)
  const [priority, setPriority] = useState<Priority>('desired')
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<string[]>([])
  const { entities, secrets } = available(api, query)
  const toggle = (source: LinkedSource) => setChosen((current) => current.includes(key(source)) ? current.filter((entry) => entry !== key(source)) : [...current, key(source)])
  const add = () => {
    const sources = chosen.map((entry) => { const [type, id] = entry.split(':'); return { type, id } as LinkedSource })
    if (sources.length) api.addLinked(sources, toTarget(where), priority)
    close()
  }
  const option = (source: LinkedSource, kicker: string, title: string, hint: string) => <label key={key(source)} className={chosen.includes(key(source)) ? 'chosen' : ''}>
    <input type="checkbox" checked={chosen.includes(key(source))} onChange={() => toggle(source)} />
    <div><span className="panel-kicker">{kicker}</span><strong>{title}</strong>{hint && <small>{hint}</small>}</div>
  </label>

  return <SessionModal title="Добавить из библиотеки" close={close}>
    <div className="library-picker">
      <div className="library-picker__target"><label>Куда<TargetSelect api={api} label="Куда добавить" value={where} onChange={setWhere} /></label><label>Приоритет<Select aria-label="Приоритет добавляемых" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>{PRIORITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label></div>
      <div className="library-picker__search"><Icon name="search" size={16} /><input autoFocus value={query} placeholder="Название, тег или тип…" aria-label="Поиск в библиотеке для сессии" onChange={(event) => setQuery(event.target.value)} /></div>
      <div className="library-picker__list">
        {entities.length > 0 && <fieldset><legend>Библиотека</legend>{entities.map((entity) => option({ type: 'entity', id: entity.id }, ENTITY_LABEL[entity.type], entity.name, entity.description))}</fieldset>}
        {secrets.length > 0 && <fieldset><legend>Секреты</legend>{secrets.map((secret) => option({ type: 'secret', id: secret.id }, 'Секрет', secret.title, secret.revealCondition ? `Раскрыть: ${secret.revealCondition}` : secret.truth))}</fieldset>}
        {!entities.length && !secrets.length && <p className="muted">{query ? 'Ничего не найдено.' : 'Всё из библиотеки и секретов уже в плане или ещё не создано. Записи создаются в разделе «Библиотека», секреты — в «Пульте».'}</p>}
      </div>
    </div>
    <footer><Button onClick={close}>Отмена</Button><Button variant="primary" icon="plus" disabled={!chosen.length} onClick={add}>{chosen.length ? `Добавить (${chosen.length})` : 'Добавить'}</Button></footer>
  </SessionModal>
}
