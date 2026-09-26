import type { DragEvent } from 'react'
import { Badge, Button, Select } from '../../../ds'
import type { LocalSessionPlanItem, LocalSessionPlanKind } from '../../../local/types'
import { PLAN_KINDS, USE_STATUS, type PlanApi } from './planApi'

/** One plan item, shared by the list and the scene board. Draggable. */
export function PlanItemCard({ api, item, onDropBefore }: { api: PlanApi; item: LocalSessionPlanItem; onDropBefore: (draggedId: string) => void }) {
  const title = api.itemTitle(item)
  const scenes = api.session.planItems.filter((entry) => entry.kind === 'scene' && entry.id !== item.id)
  const scene = item.sceneId ? api.session.planItems.find((entry) => entry.id === item.sceneId) : undefined
  const onDragStart = (event: DragEvent) => { event.dataTransfer.setData('text/plan-item', item.id); event.dataTransfer.effectAllowed = 'move' }
  const onDrop = (event: DragEvent) => { const id = event.dataTransfer.getData('text/plan-item'); if (id) { event.preventDefault(); event.stopPropagation(); onDropBefore(id) } }
  return <article draggable onDragStart={onDragStart} onDragOver={(event) => event.preventDefault()} onDrop={onDrop} aria-label={`Пункт плана: ${title}`} className={item.status === 'skipped' || item.status === 'cancelled' ? 'dimmed' : ''}>
    <div className="session-plan__item-main">
      <div className="row"><Badge size="sm" tone={item.secretId ? 'warning' : item.source === 'library' ? 'accent' : 'neutral'}>{item.secretId ? 'Секрет' : item.source === 'library' ? 'Библиотека' : 'Текст'}</Badge>{item.alternative.trim() && <Badge size="sm" tone="warning">или: {item.alternative}</Badge>}{scene && <Badge size="sm" tone="neutral">в сцене: {api.itemTitle(scene)}</Badge>}{item.carriedFromSessionId && <Badge size="sm" tone="neutral">перенесено</Badge>}<Select aria-label={`Тип ${title}`} value={item.kind} onChange={(event) => api.patchItem(item.id, { kind: event.target.value as LocalSessionPlanKind })}>{PLAN_KINDS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</Select></div>
      <h3>{title}</h3>
      <input value={item.note} aria-label={`Заметка ${title}`} placeholder="Локальная заметка, условие или роль…" onChange={(event) => api.patchItem(item.id, { note: event.target.value })} />
      <details className="session-plan__item-links"><summary>Связи пункта</summary><div className="row">
        <label>Группа «или-или»<input list={`alt-groups-${api.session.id}`} aria-label={`Группа «или-или»: ${title}`} value={item.alternative} placeholder="Например, «вход в порт»" onChange={(event) => api.patchItem(item.id, { alternative: event.target.value })} /></label>
        {item.kind !== 'scene' && <label>Сцена<Select aria-label={`Сцена: ${title}`} value={item.sceneId ?? ''} onChange={(event) => api.patchItem(item.id, { sceneId: event.target.value || undefined })}><option value="">Без сцены</option>{scenes.map((entry) => <option key={entry.id} value={entry.id}>{api.itemTitle(entry)}</option>)}</Select></label>}
      </div></details>
    </div>
    <div className="session-plan__item-controls">
      <Select aria-label={`Статус ${title}`} value={item.status} onChange={(event) => api.setStatus(item.id, event.target.value as LocalSessionPlanItem['status'])}>{USE_STATUS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</Select>
      <div className="row"><Button size="sm" aria-label={`Выше: ${title}`} onClick={() => api.shift(item.id, -1)}>↑</Button><Button size="sm" aria-label={`Ниже: ${title}`} onClick={() => api.shift(item.id, 1)}>↓</Button>{item.source === 'text' && !item.secretId && <Button size="sm" icon={item.kind === 'secret' ? 'shield' : 'library'} onClick={() => api.saveToLibrary(item)}>{item.kind === 'secret' ? 'В секреты' : 'В библиотеку'}</Button>}<Button size="sm" tone="danger" icon="trash-2" aria-label={`Убрать ${title} из сессии`} onClick={() => api.remove(item.id)} /></div>
    </div>
  </article>
}
