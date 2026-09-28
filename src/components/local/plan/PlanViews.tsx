import { lazy, Suspense, useState, type DragEvent, type ReactNode } from 'react'
import { Badge, Button, Select } from '../../../ds'
import { AUTOMATIC_LOG, TIMELINE_DEFAULT, addFlow, alternativeGroups, filterTimeline, timeline, type TimelineOptions } from '../../../local/plan'
import { PeekLink } from '../Peek'
import type { LocalSessionPlanItem } from '../../../local/types'
import { PlanItemCard } from './PlanItemCard'
import { SceneTree } from './SceneTree'
import { LazyBoundary } from '../LazyBoundary'
import { DRAG_ITEM, type PlanApi } from './planApi'
import { PRIORITIES, USE_STATUS_LABEL } from '../../../local/labels'

const PlanGraph = lazy(() => import('./PlanGraph'))

type View = 'tree' | 'list' | 'graph' | 'timeline'
const VIEWS: Array<[View, string]> = [['tree', 'Сцены'], ['list', 'По приоритету'], ['graph', 'Граф переходов'], ['timeline', 'Временная линия']]

const dropZone = (onDropId: (id: string) => void) => ({
  onDragOver: (event: DragEvent) => event.preventDefault(),
  onDrop: (event: DragEvent) => { const id = event.dataTransfer.getData(DRAG_ITEM); if (id) { event.preventDefault(); onDropId(id) } },
})

/** The plan of one session in several views; `actions` sit next to the view switch, `panel` opens beside the plan. */
export function PlanViews({ api, actions, panel }: { api: PlanApi; actions?: ReactNode; panel?: ReactNode }) {
  const [view, setView] = useState<View>('tree')
  const groups = alternativeGroups(api.session)
  return <>
    <datalist id={`alt-groups-${api.session.id}`}>{groups.map((group) => <option key={group} value={group} />)}</datalist>
    <div className="session-plan__toolbar"><div className="campaign-relation-map__filters session-plan__views" role="group" aria-label="Вид плана">{VIEWS.map(([id, label]) => <button key={id} className={view === id ? 'active' : ''} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}</div>{actions && <div className="session-plan__toolbar-actions">{actions}</div>}</div>
    <div className={`session-plan__workspace${panel ? ' session-plan__workspace--with-panel' : ''}`}>
      <div className="session-plan__canvas">
        {view === 'tree' && <SceneTree api={api} />}
        {view === 'list' && <PlanList api={api} />}
        {view === 'graph' && <LazyBoundary><Suspense fallback={<p className="muted">Загружаем граф…</p>}><PlanGraph api={api} /></Suspense></LazyBoundary>}
        {view === 'timeline' && <PlanTimeline api={api} />}
        {view !== 'timeline' && <FlowsEditor api={api} />}
      </div>
      {panel}
    </div>
  </>
}

function PlanList({ api }: { api: PlanApi }) {
  return <div className="session-plan__columns">{PRIORITIES.map(([priority, label]) => {
    const list = api.session.planItems.filter((item) => item.priority === priority)
    return <section key={priority} data-priority={priority} aria-label={label} {...dropZone((id) => api.move(id, { priority }))}><header><h2>{label}</h2><span>{list.length}</span></header>{list.map((item) => <PlanItemCard key={item.id} api={api} item={item} onDropBefore={(id) => api.move(id, { beforeId: item.id })} />)}{!list.length && <p className="session-plan__empty">Пока пусто — перетащите сюда пункт</p>}</section>
  })}</div>
}

const TIMELINE_KEY = 'masterboard.timeline'
const TIMELINE_TOGGLES: Array<[keyof TimelineOptions, string]> = [['dropped', 'Пропущенные и отменённые'], ['others', 'Не-события'], ['journal', 'Журнал'], ['automatic', 'Автозаписи']]
const readTimelineOptions = (): TimelineOptions => { try { return { ...TIMELINE_DEFAULT, ...JSON.parse(window.localStorage.getItem(TIMELINE_KEY) ?? '{}') } } catch { return TIMELINE_DEFAULT } }

/** Timeline (ТЗ-2, R8 C): scenes, events, goals and consequences by default; the rest behind switches, remembered in this browser. */
function PlanTimeline({ api }: { api: PlanApi }) {
  const [options, setOptionsState] = useState<TimelineOptions>(readTimelineOptions)
  const setOptions = (next: TimelineOptions) => { setOptionsState(next); try { window.localStorage.setItem(TIMELINE_KEY, JSON.stringify(next)) } catch { /* private window */ } }
  const all = timeline(api.session)
  const steps = filterTimeline(all, options)
  const log = options.journal ? api.session.log.filter((entry) => options.automatic || !AUTOMATIC_LOG.has(entry.kind)) : []
  const hiddenLog = options.journal && !options.automatic ? api.session.log.length - log.length : 0
  const card = (item: LocalSessionPlanItem, children: LocalSessionPlanItem[]) => <div className={`plan-timeline__card plan-timeline__card--${item.status}`}><strong>{item.entityId ? <PeekLink target={{ kind: 'entity', id: item.entityId }}>{api.itemTitle(item)}</PeekLink> : api.itemTitle(item)}</strong><small>{USE_STATUS_LABEL[item.status]}</small>{children.length > 0 && <ul>{children.map((child) => <li key={child.id}>{api.itemTitle(child)}</li>)}</ul>}</div>
  return <div className="plan-timeline" aria-label="Временная линия">
    <div className="plan-timeline__filters" role="group" aria-label="Что показывать">{TIMELINE_TOGGLES.map(([key, label]) => <label key={key} className={`home-chip${options[key] ? ' on' : ''}`}><input type="checkbox" checked={options[key]} disabled={key === 'automatic' && !options.journal} onChange={() => setOptions({ ...options, [key]: !options[key] })} />{label}</label>)}</div>
    {steps.length ? <ol className="plan-timeline__plan">{steps.map((step, index) => <li key={step.kind === 'single' ? step.item.id : `fork-${step.group}`} aria-label={step.kind === 'fork' ? `Развилка: ${step.group}` : undefined}><span className="plan-timeline__index">{index + 1}</span>{step.kind === 'single' ? card(step.item, step.children) : <div className="plan-timeline__fork"><Badge size="sm" tone="warning">или: {step.group}</Badge>{step.branches.map((branch) => <div key={branch.item.id}>{card(branch.item, branch.children)}</div>)}</div>}</li>)}</ol> : <p className="session-plan__notice">{all.length ? 'Сцен и событий в плане нет — включите «Прочие пункты», чтобы увидеть остальное.' : 'План пуст.'}</p>}
    {log.length > 0 && <><h3>Как было на самом деле</h3><ol className="plan-timeline__log">{log.map((entry) => <li key={entry.id}><time>{new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time><span>{entry.text}</span></li>)}</ol></>}
    {hiddenLog > 0 && <p className="muted">Скрыто автозаписей журнала: {hiddenLog}.</p>}
  </div>
}

function FlowsEditor({ api }: { api: PlanApi }) {
  const items = api.session.planItems
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [condition, setCondition] = useState('')
  if (items.length < 2) return null
  const title = (id: string) => { const item = items.find((entry) => entry.id === id); return item ? api.itemTitle(item) : 'Удалённый пункт' }
  const add = () => { if (!from || !to || from === to) return; api.update(addFlow(api.session, from, to, condition)); setCondition('') }
  return <section className="plan-flows" aria-label="Переходы">
    <header><h3>Переходы</h3><p className="muted">Куда ведёт сцена и при каком условии. В графе переход можно протянуть мышью.</p></header>
    {api.session.flows.length > 0 && <ul>{api.session.flows.map((flow) => <li key={flow.id}><span>{title(flow.fromItemId)} → {title(flow.toItemId)}{flow.condition && <em> — если {flow.condition}</em>}</span><Button size="sm" tone="danger" icon="trash-2" aria-label={`Удалить переход ${title(flow.fromItemId)} → ${title(flow.toItemId)}`} onClick={() => api.update({ ...api.session, flows: api.session.flows.filter((entry) => entry.id !== flow.id) })} /></li>)}</ul>}
    <div className="plan-flows__form"><Select aria-label="Переход из" value={from} onChange={(event) => setFrom(event.target.value)}><option value="">Откуда…</option>{items.map((item) => <option key={item.id} value={item.id}>{api.itemTitle(item)}</option>)}</Select><Select aria-label="Переход в" value={to} onChange={(event) => setTo(event.target.value)}><option value="">Куда…</option>{items.filter((item) => item.id !== from).map((item) => <option key={item.id} value={item.id}>{api.itemTitle(item)}</option>)}</Select><input aria-label="Условие перехода" value={condition} placeholder="Условие (необязательно)" onChange={(event) => setCondition(event.target.value)} /><Button icon="plus" disabled={!from || !to || from === to} onClick={add}>Добавить переход</Button></div>
  </section>
}
