import { useState, type DragEvent } from 'react'
import { Badge, Button, Icon, Select } from '../../../ds'
import { ENTITY_FIELDS } from '../../../local/domain'
import type { LocalSessionPlanItem, LocalSessionPlanKind } from '../../../local/types'
import { ENTITY_LABEL, SubmitField } from '../shared'
import { DRAG_ITEM, DRAG_SOURCE, KIND_LABEL, PLAN_KINDS, PRIORITIES, USE_STATUS, type LinkedSource, type PlanApi, type PlanTarget } from './planApi'

type Item = LocalSessionPlanItem

/** Reads a drag payload: an item already in the plan, or a library record / secret from the add panel. */
function dragged(event: DragEvent, api: PlanApi): { item?: Item; source?: LinkedSource } {
  const id = event.dataTransfer.getData(DRAG_ITEM)
  const item = id ? api.session.planItems.find((entry) => entry.id === id) : undefined
  if (item) return { item }
  const [type, sourceId] = event.dataTransfer.getData(DRAG_SOURCE).split(':')
  return (type === 'entity' || type === 'secret') && sourceId ? { source: { type, id: sourceId } } : {}
}

/** Drop target that puts dragged items into a scene (or outside scenes) and adds dragged library records there. */
function dropInto(api: PlanApi, target: PlanTarget, onScene?: (scene: Item) => void) {
  return {
    onDragOver: (event: DragEvent) => event.preventDefault(),
    onDrop: (event: DragEvent) => {
      const { item, source } = dragged(event, api)
      if (!item && !source) return
      event.preventDefault()
      event.stopPropagation()
      if (source) api.addLinked([source], target, 'desired')
      else if (item?.kind === 'scene') onScene?.(item)
      else if (item) api.move(item.id, { sceneId: target })
    },
  }
}


/**
 * The session as a tree: scenes are the roots, everything played inside a
 * scene hangs under it. Priority («обязательно», «желательно»…) is a status of
 * each scene and each item, not a grouping.
 */
export function SceneTree({ api }: { api: PlanApi }) {
  const [collapsed, setCollapsed] = useState<string[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const { session } = api
  const scenes = session.planItems.filter((item) => item.kind === 'scene')
  const sceneIds = new Set(scenes.map((scene) => scene.id))
  const loose = session.planItems.filter((item) => item.kind !== 'scene' && !(item.sceneId && sceneIds.has(item.sceneId)))
  const toggle = (id: string) => setCollapsed((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id])
  const node = (item: Item) => <TreeItem key={item.id} api={api} item={item} open={openId === item.id} toggle={() => setOpenId(openId === item.id ? null : item.id)} />

  return <div className="scene-tree">
    {!scenes.length && <p className="session-plan__notice">Сцен пока нет. Откройте «Добавить в план» и создайте пункт вида «Сцена» — в неё можно класть NPC, секреты, события и материалы.</p>}
    {scenes.length > 0 && <ol className="scene-tree__scenes">{scenes.map((scene, index) => {
      const title = api.itemTitle(scene)
      const members = session.planItems.filter((item) => item.sceneId === scene.id)
      const isOpen = !collapsed.includes(scene.id)
      return <li key={scene.id}>
        <section className={`scene-tree__scene scene-tree__scene--${scene.priority}${scene.status === 'skipped' || scene.status === 'cancelled' ? ' dimmed' : ''}`} aria-label={`Сцена: ${title}`} {...dropInto(api, scene.id, (dropped) => api.move(dropped.id, { beforeId: scene.id, keepPriority: true }))}>
          <header draggable onDragStart={(event) => { event.dataTransfer.setData(DRAG_ITEM, scene.id); event.dataTransfer.effectAllowed = 'move' }}>
            <button className="scene-tree__toggle" aria-expanded={isOpen} aria-label={`${isOpen ? 'Свернуть' : 'Развернуть'} сцену ${title}`} onClick={() => toggle(scene.id)}><Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={18} /></button>
            <span className="scene-tree__index">{String(index + 1).padStart(2, '0')}</span>
            <h3>{title}</h3>
            {scene.alternative.trim() && <Badge size="sm" tone="warning">или: {scene.alternative}</Badge>}
            {!isOpen && <span className="scene-tree__count">{members.length ? `пунктов: ${members.length}` : 'пусто'}</span>}
            <div className="scene-tree__controls">
              <PrioritySelect api={api} item={scene} />
              <StatusSelect api={api} item={scene} />
              <Button size="sm" icon="plus" aria-label={`Добавить из библиотеки в сцену ${title}`} title="Добавить из библиотеки в эту сцену" onClick={() => api.openPicker(scene.id)}>Библиотека</Button>
              <MoveButtons api={api} item={scene} title={title} />
            </div>
          </header>
          {isOpen && <div className="scene-tree__body">
            {scene.note && <p className="scene-tree__comment">{scene.note}</p>}
            <details className="scene-tree__scene-edit"><summary>Комментарий и связи сцены</summary>
              <SubmitField label={`Комментарий к сцене ${title}`} value={scene.note} placeholder="Условие входа, настроение, что должно случиться…" onSubmit={(note) => api.patchItem(scene.id, { note })} />
              <SubmitField label={`Группа «или-или»: ${title}`} value={scene.alternative} placeholder="Группа «или-или», например «вход в порт»" onSubmit={(alternative) => api.patchItem(scene.id, { alternative })} />
            </details>
            {members.length > 0 ? <ul className="scene-tree__items">{members.map(node)}</ul> : <p className="scene-tree__hint">Перетащите сюда пункты или добавьте «Из библиотеки».</p>}
          </div>}
        </section>
      </li>
    })}</ol>}
    <section className="scene-tree__loose" aria-label="Вне сцен" {...dropInto(api, null)}>
      <header><h3>Вне сцен</h3><span className="scene-tree__count">{loose.length}</span><Button size="sm" icon="library" aria-label="Добавить из библиотеки вне сцен" onClick={() => api.openPicker(null)}>Из библиотеки</Button></header>
      {loose.length > 0 ? <ul className="scene-tree__items">{loose.map(node)}</ul> : <p className="scene-tree__hint">Здесь то, что не привязано к сцене: запасные NPC, вопросы, идеи.</p>}
    </section>
  </div>
}

function PrioritySelect({ api, item }: { api: PlanApi; item: Item }) {
  const title = api.itemTitle(item)
  return <select className={`scene-tree__select scene-tree__select--${item.priority}`} aria-label={`Приоритет ${title}`} value={item.priority} onChange={(event) => api.patchItem(item.id, { priority: event.target.value as Item['priority'] })}>{PRIORITIES.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
}

function StatusSelect({ api, item }: { api: PlanApi; item: Item }) {
  return <select className="scene-tree__select" aria-label={`Статус ${api.itemTitle(item)}`} value={item.status} onChange={(event) => api.setStatus(item.id, event.target.value as Item['status'])}>{USE_STATUS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
}

function MoveButtons({ api, item, title }: { api: PlanApi; item: Item; title: string }) {
  return <span className="scene-tree__move"><Button size="sm" icon="pencil" aria-label={`Редактировать: ${title}`} title="Редактировать" onClick={() => api.editItem(item.id)} /><Button size="sm" aria-label={`Выше: ${title}`} onClick={() => api.shiftAmongPeers(item.id, -1)}>↑</Button><Button size="sm" aria-label={`Ниже: ${title}`} onClick={() => api.shiftAmongPeers(item.id, 1)}>↓</Button><Button size="sm" tone="danger" icon="trash-2" aria-label={`Убрать ${title} из сессии`} onClick={() => api.remove(item.id)} /></span>
}

function TreeItem({ api, item, open, toggle }: { api: PlanApi; item: Item; open: boolean; toggle: () => void }) {
  const title = api.itemTitle(item)
  const entity = item.entityId ? api.campaign.entities.find((entry) => entry.id === item.entityId) : undefined
  const secret = item.secretId ? api.campaign.secrets.find((entry) => entry.id === item.secretId) : undefined
  const scenes = api.session.planItems.filter((entry) => entry.kind === 'scene')
  const onDrop = (event: DragEvent) => {
    const { item: moved } = dragged(event, api)
    if (!moved || moved.kind === 'scene' || moved.id === item.id) return
    event.preventDefault()
    event.stopPropagation()
    api.move(moved.id, { beforeId: item.id, keepPriority: true })
  }
  return <li draggable onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.setData(DRAG_ITEM, item.id); event.dataTransfer.effectAllowed = 'move' }} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
    <article aria-label={`Пункт плана: ${title}`} className={`scene-tree__item scene-tree__item--${item.priority}${item.status === 'skipped' || item.status === 'cancelled' ? ' dimmed' : ''}`}>
      <div className="scene-tree__row">
        <button className="scene-tree__title" aria-expanded={open} aria-label={`${open ? 'Скрыть' : 'Показать'} подробности: ${title}`} onClick={toggle}><Icon name={open ? 'chevron-down' : 'chevron-right'} size={15} /><strong>{title}</strong></button>
        <span className="scene-tree__badges"><Badge size="sm" tone="neutral">{entity ? ENTITY_LABEL[entity.type] : KIND_LABEL[item.kind]}</Badge>{secret && <Badge size="sm" tone="warning">Секрет</Badge>}{entity && <Badge size="sm" tone="accent">Библиотека</Badge>}{item.alternative.trim() && <Badge size="sm" tone="warning">или: {item.alternative}</Badge>}{item.carriedFromSessionId && <Badge size="sm" tone="neutral">перенесено</Badge>}</span>
        <div className="scene-tree__controls"><PrioritySelect api={api} item={item} /><StatusSelect api={api} item={item} /><MoveButtons api={api} item={item} title={title} /></div>
      </div>
      {!open && (item.note || entity?.description) && <p className="scene-tree__note">{item.note || entity?.description}</p>}
      {open && <div className="scene-tree__details">
        {entity && <div className="scene-tree__record">
          <p>{entity.description || 'Описание пока не добавлено.'}</p>
          {ENTITY_FIELDS[entity.type].some((field) => entity.fields[field.id]) && <dl>{ENTITY_FIELDS[entity.type].filter((field) => entity.fields[field.id]).map((field) => <div key={field.id}><dt>{field.label}</dt><dd>{entity.fields[field.id]}</dd></div>)}</dl>}
          <footer>{entity.tags.map((tag) => <Badge size="sm" key={tag}>#{tag}</Badge>)}<Badge size="sm" tone={entity.visibility === 'public' ? 'success' : 'warning'}>{entity.visibility === 'public' ? 'Для игроков' : 'Только ведущим'}</Badge><Button size="sm" icon="pencil" aria-label={`Редактировать запись: ${title}`} onClick={() => api.editEntity(entity.id)}>Редактировать запись</Button></footer>
        </div>}
        {secret && <div className="scene-tree__record"><dl><div><dt>Правда</dt><dd>{secret.truth || '—'}</dd></div>{secret.revealCondition && <div><dt>Раскрыть, когда</dt><dd>{secret.revealCondition}</dd></div>}</dl></div>}
        <SubmitField label={`Заметка ${title}`} value={item.note} placeholder="Заметка для этой сессии: условие, роль, реплика…" onSubmit={(note) => api.patchItem(item.id, { note })} />
        <div className="scene-tree__links">
          <label>Сцена<Select aria-label={`Сцена: ${title}`} value={item.sceneId && scenes.some((scene) => scene.id === item.sceneId) ? item.sceneId : ''} onChange={(event) => api.move(item.id, { sceneId: event.target.value || null })}><option value="">Вне сцен</option>{scenes.map((scene) => <option key={scene.id} value={scene.id}>{api.itemTitle(scene)}</option>)}</Select></label>
          {!entity && !secret && <label>Тип<Select aria-label={`Тип ${title}`} value={item.kind} onChange={(event) => api.patchItem(item.id, { kind: event.target.value as LocalSessionPlanKind })}>{PLAN_KINDS.filter(([value]) => value !== 'scene').map(([value, name]) => <option key={value} value={value}>{name}</option>)}</Select></label>}
          <SubmitField label={`Группа «или-или»: ${title}`} value={item.alternative} placeholder="Группа «или-или»" onSubmit={(alternative) => api.patchItem(item.id, { alternative })} />
        </div>
        {item.source === 'text' && !item.secretId && <Button size="sm" icon={item.kind === 'secret' ? 'shield' : 'library'} onClick={() => api.saveToLibrary(item)}>{item.kind === 'secret' ? 'В секреты' : 'В библиотеку'}</Button>}
      </div>}
    </article>
  </li>
}
