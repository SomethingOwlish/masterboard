import { lazy, Suspense, useState, type DragEvent } from 'react'
import { Badge, Button, Select } from '../../../ds'
import { addFlow, alternativeGroups, timeline } from '../../../local/plan'
import type { LocalSessionPlanItem } from '../../../local/types'
import { PlanItemCard } from './PlanItemCard'
import { PRIORITIES, USE_STATUS, type PlanApi } from './planApi'

const PlanGraph = lazy(() => import('./PlanGraph'))

type View = 'list' | 'board' | 'graph' | 'timeline'
const VIEWS: Array<[View, string]> = [['list', 'Список'], ['board', 'Доска сцен'], ['graph', 'Граф переходов'], ['timeline', 'Временная линия']]
const statusName = Object.fromEntries(USE_STATUS) as Record<LocalSessionPlanItem['status'], string>

const dropZone = (onDropId: (id: string) => void) => ({
  onDragOver: (event: DragEvent) => event.preventDefault(),
  onDrop: (event: DragEvent) => { const id = event.dataTransfer.getData('text/plan-item'); if (id) { event.preventDefault(); onDropId(id) } },
})

export function PlanViews({ api }: { api: PlanApi }) {
  const [view, setView] = useState<View>('list')
  const groups = alternativeGroups(api.session)
  return <>
    <datalist id={`alt-groups-${api.session.id}`}>{groups.map((group) => <option key={group} value={group} />)}</datalist>
    <div className="campaign-relation-map__filters session-plan__views" role="group" aria-label="Вид плана">{VIEWS.map(([id, label]) => <button key={id} className={view === id ? 'active' : ''} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}</div>
    {view === 'list' && <PlanList api={api} />}
    {view === 'board' && <PlanBoard api={api} />}
    {view === 'graph' && <Suspense fallback={<p className="muted">Загружаем граф…</p>}><PlanGraph api={api} /></Suspense>}
    {view === 'timeline' && <PlanTimeline api={api} />}
    {(view === 'list' || view === 'graph') && <FlowsEditor api={api} />}
  </>
}

function PlanList({ api }: { api: PlanApi }) {
  return <div className="session-plan__columns">{PRIORITIES.map(([priority, label]) => {
    const list = api.session.planItems.filter((item) => item.priority === priority)
    return <section key={priority} data-priority={priority} aria-label={label} {...dropZone((id) => api.move(id, { priority }))}><header><h2>{label}</h2><span>{list.length}</span></header>{list.map((item) => <PlanItemCard key={item.id} api={api} item={item} onDropBefore={(id) => api.move(id, { beforeId: item.id })} />)}{!list.length && <p className="session-plan__empty">Пока пусто — перетащите сюда пункт</p>}</section>
  })}</div>
}

function PlanBoard({ api }: { api: PlanApi }) {
  const scenes = api.session.planItems.filter((item) => item.kind === 'scene')
  const loose = api.session.planItems.filter((item) => item.kind !== 'scene' && (!item.sceneId || !scenes.some((scene) => scene.id === item.sceneId)))
  if (!scenes.length) return <p className="session-plan__notice">На доске сцен пока нечего показать. Добавьте пункт вида «Сцена», и сюда можно будет перетаскивать NPC, секреты и материалы.</p>
  return <div className="plan-board">
    {scenes.map((scene) => { const members = api.session.planItems.filter((item) => item.sceneId === scene.id); return <section key={scene.id} className="plan-board__scene" aria-label={`Сцена: ${api.itemTitle(scene)}`} {...dropZone((id) => api.move(id, { sceneId: scene.id }))}>
      <header><div className="row">{scene.alternative.trim() && <Badge size="sm" tone="warning">или: {scene.alternative}</Badge>}<Badge size="sm" tone={scene.status === 'used' ? 'success' : 'neutral'}>{statusName[scene.status]}</Badge></div><h3>{api.itemTitle(scene)}</h3>{scene.note && <p>{scene.note}</p>}</header>
      <ul>{members.map((item) => <li key={item.id} draggable onDragStart={(event) => event.dataTransfer.setData('text/plan-item', item.id)}><span>{api.itemTitle(item)}</span><Button size="sm" aria-label={`Убрать ${api.itemTitle(item)} из сцены`} onClick={() => api.move(item.id, { sceneId: null })}>×</Button></li>)}{!members.length && <li className="muted">Перетащите сюда пункты</li>}</ul>
    </section> })}
    <section className="plan-board__scene plan-board__loose" aria-label="Без сцены" {...dropZone((id) => api.move(id, { sceneId: null }))}><header><h3>Без сцены</h3></header><ul>{loose.map((item) => <li key={item.id} draggable onDragStart={(event) => event.dataTransfer.setData('text/plan-item', item.id)}><span>{api.itemTitle(item)}</span><Select aria-label={`Сцена: ${api.itemTitle(item)}`} value="" onChange={(event) => event.target.value && api.move(item.id, { sceneId: event.target.value })}><option value="">В сцену…</option>{scenes.map((scene) => <option key={scene.id} value={scene.id}>{api.itemTitle(scene)}</option>)}</Select></li>)}{!loose.length && <li className="muted">Все пункты разложены по сценам</li>}</ul></section>
  </div>
}

function PlanTimeline({ api }: { api: PlanApi }) {
  const steps = timeline(api.session)
  const card = (item: LocalSessionPlanItem, children: LocalSessionPlanItem[]) => <div className={`plan-timeline__card plan-timeline__card--${item.status}`}><strong>{api.itemTitle(item)}</strong><small>{statusName[item.status]}</small>{children.length > 0 && <ul>{children.map((child) => <li key={child.id}>{api.itemTitle(child)}</li>)}</ul>}</div>
  if (!steps.length) return <p className="session-plan__notice">План пуст.</p>
  return <div className="plan-timeline" aria-label="Временная линия">
    <ol className="plan-timeline__plan">{steps.map((step, index) => <li key={step.kind === 'single' ? step.item.id : `fork-${step.group}`} aria-label={step.kind === 'fork' ? `Развилка: ${step.group}` : undefined}><span className="plan-timeline__index">{index + 1}</span>{step.kind === 'single' ? card(step.item, step.children) : <div className="plan-timeline__fork"><Badge size="sm" tone="warning">или: {step.group}</Badge>{step.branches.map((branch) => <div key={branch.item.id}>{card(branch.item, branch.children)}</div>)}</div>}</li>)}</ol>
    {api.session.log.length > 0 && <><h3>Как было на самом деле</h3><ol className="plan-timeline__log">{api.session.log.map((entry) => <li key={entry.id}><time>{new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time><span>{entry.text}</span></li>)}</ol></>}
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
