import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Background, Controls, Handle, MarkerType, NodeResizer, Position, applyNodeChanges, useReactFlow, useNodesInitialized, type Node, type NodeProps, type NodeChange, type Connection } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Button } from '../ds'
import type { LocalCampaignEntity, LocalSessionScene } from '../fixtures/localCampaignCatalog'
import { addSceneMember, moveSceneMember, removeBoardScene, removeSceneMember, scenePosition, sceneSize, tokenPosition, TOKEN_SIZE } from '../lib/localSessionBoard'

type SceneData = Record<string, unknown> & { title: string; purpose: string; readonly: boolean; minWidth: number; minHeight: number; resize: (width: number, height: number, x: number, y: number) => void }
function BoardScene({ data, selected }: NodeProps) {
  const scene = data as SceneData
  return <div className="real-board-scene">
    {!scene.readonly && <NodeResizer minWidth={scene.minWidth} minHeight={scene.minHeight} isVisible={selected} onResizeEnd={(_, size) => scene.resize(size.width, size.height, size.x, size.y)} />}
    <Handle type="target" position={Position.Left} isConnectable={!scene.readonly} aria-label={`Вход сцены ${scene.title}`} />
    <div className="real-board-scene__head"><strong>{scene.title}</strong><small>{scene.purpose}</small></div>
    <Handle type="source" position={Position.Right} isConnectable={!scene.readonly} aria-label={`Выход сцены ${scene.title}`} />
  </div>
}
function BoardToken({ data }: NodeProps) {
  return <div className={`real-board-token${data.missing ? ' is-missing' : ''}`} title={String(data.description ?? '')}>{String(data.name)}</div>
}
const nodeTypes = { scene: BoardScene, token: BoardToken }
const TYPE_LABEL: Record<LocalCampaignEntity['type'], string> = { character: 'Персонаж', npc: 'NPC', event: 'Событие', creature: 'Существо', location: 'Локация', faction: 'Фракция', rumor: 'Слух', item: 'Предмет', audience: 'Аудитория', note: 'Заметка', letter: 'Письмо', handout: 'Раздаточный материал', map: 'Карта', 'home-rule': 'Домашнее правило' }
const tokenId = (sceneId: string, entityId: string) => JSON.stringify([sceneId, entityId])

interface BoardProps {
  scenes: LocalSessionScene[]
  entities: LocalCampaignEntity[]
  readonly?: boolean
  savedLabel?: string
  onChange: (scenes: LocalSessionScene[]) => boolean
}
export function LocalSessionBoard(props: BoardProps) {
  return <ReactFlowProvider><Board {...props} /></ReactFlowProvider>
}

function Board({ scenes, entities, readonly = false, savedLabel = 'Доска сохранена в браузере', onChange }: BoardProps) {
  const { screenToFlowPosition, fitView } = useReactFlow()
  const [selectedSceneId, selectScene] = useState(scenes[0]?.id ?? '')
  const [selectedToken, selectToken] = useState<{ sceneId: string; entityId: string } | null>(null)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [linkTarget, setLinkTarget] = useState('')
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId)
  const targetId = selectedScene?.id ?? scenes[0]?.id ?? ''
  const selectedEntity = entities.find((entity) => entity.id === selectedToken?.entityId)
  const canvas = useRef<HTMLDivElement>(null)
  const needsFit = useRef(false)
  const nodesInitialized = useNodesInitialized()
  const save = useCallback((next: LocalSessionScene[]) => {
    if (readonly) return false
    const saved = onChange(next)
    setMessage(saved ? savedLabel : 'Не удалось сохранить. Повторите изменение после устранения ошибки.')
    return saved
  }, [readonly, onChange, savedLabel])
  const flowNodes = useMemo<Node[]>(() => [
    ...scenes.map((scene, index): Node => {
      const size = sceneSize(scene)
      const positions = (scene.memberIds ?? []).map((id) => tokenPosition(scene, id))
      return { id: scene.id, type: 'scene', ariaLabel: `Сцена: ${scene.title}`, position: scenePosition(scene, index), style: size,
        dragHandle: '.real-board-scene__head', data: { title: scene.title, purpose: scene.purpose, readonly,
          minWidth: Math.max(240, ...positions.map((point) => point.x + TOKEN_SIZE.width + 12)),
          minHeight: Math.max(160, ...positions.map((point) => point.y + TOKEN_SIZE.height + 12)),
          resize: (width: number, height: number, x: number, y: number) => { save(scenes.map((item) => item.id === scene.id ? { ...item, position: { x, y }, size: { width, height } } : item)) },
        } satisfies SceneData }
    }),
    ...scenes.flatMap((scene) => (scene.memberIds ?? []).map((id): Node => {
      const entity = entities.find((item) => item.id === id)
      return { id: tokenId(scene.id, id), type: 'token', ariaLabel: `${entity?.name ?? 'Удалённый объект'} — ${scene.title}`, parentId: scene.id, position: tokenPosition(scene, id), style: TOKEN_SIZE,
        data: { sceneId: scene.id, entityId: id, name: entity?.name ?? 'Объект удалён из библиотеки', description: entity?.description, missing: !entity } }
    })),
  ], [scenes, entities, readonly, save])
  const [nodes, setNodes] = useState<Node[]>(flowNodes)
  const nodesRef = useRef(nodes)
  const replaceNodes = (next: Node[]) => { nodesRef.current = next; setNodes(next) }
  useEffect(() => { nodesRef.current = flowNodes; setNodes(flowNodes) }, [flowNodes])
  useEffect(() => {
    if (nodesInitialized && needsFit.current) {
      needsFit.current = false
      void fitView({ padding: 0.2, maxZoom: 1 })
    }
  }, [nodesInitialized, nodes.length, fitView])
  const edges = scenes.flatMap((scene) => (scene.nextSceneIds ?? []).filter((id) => scenes.some((item) => item.id === id)).map((id) => ({ id: JSON.stringify([scene.id, id]), source: scene.id, target: id, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'var(--text)', strokeWidth: 2 } })))
  const connect = ({ source, target }: Connection) => {
    if (!source || !target || source === target) return
    save(scenes.map((scene) => scene.id === source ? { ...scene, nextSceneIds: [...new Set([...(scene.nextSceneIds ?? []), target])] } : scene))
  }
  const changeNodes = (changes: NodeChange[]) => {
    const next = applyNodeChanges(changes, nodesRef.current)
    replaceNodes(next)
    // React Flow keyboard movement has no pointer drag-stop event.
    const moved = changes.flatMap((change) => change.type === 'position' && change.position && change.dragging === undefined ? [change.id] : [])
    if (moved.length && !readonly) {
      const ids = new Set(moved)
      const updated = scenes.map((scene) => {
        const node = next.find((item) => item.id === scene.id)
        return { ...scene, ...(node && ids.has(scene.id) ? { position: node.position } : {}), tokenPositions: Object.fromEntries((scene.memberIds ?? []).map((id) => [id, next.find((item) => item.id === tokenId(scene.id, id))?.position ?? tokenPosition(scene, id)])) }
      })
      if (!save(updated)) replaceNodes(flowNodes)
    }
  }
  const moveNode = (node: Node) => {
    if (readonly) return
    if (node.type === 'scene') {
      if (!save(scenes.map((scene) => scene.id === node.id ? { ...scene, position: node.position } : scene))) replaceNodes(flowNodes)
      return
    }
    const parent = nodesRef.current.find((item) => item.id === node.parentId)
    const absolute = { x: (parent?.position.x ?? 0) + node.position.x, y: (parent?.position.y ?? 0) + node.position.y }
    const target = [...scenes].reverse().find((scene) => {
      const point = scenePosition(scene, scenes.indexOf(scene)); const size = sceneSize(scene)
      return absolute.x + TOKEN_SIZE.width / 2 >= point.x && absolute.x + TOKEN_SIZE.width / 2 <= point.x + size.width && absolute.y + TOKEN_SIZE.height / 2 >= point.y && absolute.y + TOKEN_SIZE.height / 2 <= point.y + size.height
    })
    if (!target) { replaceNodes(flowNodes); setMessage('Перетащите объект внутрь сцены. Прежнее расположение сохранено.'); return }
    const base = scenePosition(target, scenes.indexOf(target))
    if (save(moveSceneMember(scenes, String(node.data.sceneId), target.id, String(node.data.entityId), { x: absolute.x - base.x, y: absolute.y - base.y }))) {
      selectScene(target.id); selectToken({ sceneId: target.id, entityId: String(node.data.entityId) })
    } else replaceNodes(flowNodes)
  }
  const add = (entityId: string, sceneId = targetId, point?: { x: number; y: number }) => {
    if (!sceneId) { setMessage('Сначала создайте сцену.'); return }
    if (save(addSceneMember(scenes, sceneId, entityId, point))) { selectScene(sceneId); selectToken({ sceneId, entityId }) }
  }
  const addScene = () => {
    const bounds = canvas.current?.getBoundingClientRect()
    const center = bounds ? screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }) : { x: 0, y: 0 }
    const point = scenes.length ? { x: Math.max(...scenes.map((scene, index) => scenePosition(scene, index).x + sceneSize(scene).width)) + 80, y: scenePosition(scenes[0], 0).y } : { x: center.x - 180, y: center.y - 130 }
    const id = `scene-${crypto.randomUUID()}`
    if (save([...scenes, { id, title: `Сцена ${scenes.length + 1}`, purpose: '', memberIds: [], position: point }])) {
      selectScene(id); selectToken(null)
      needsFit.current = true
    }
  }
  const reorder = (delta: number) => {
    const index = scenes.findIndex((scene) => scene.id === targetId)
    if (index < 0 || index + delta < 0 || index + delta >= scenes.length) return
    const next = scenes.map((scene, i) => ({ ...scene, position: scenePosition(scene, i) }))
    const [scene] = next.splice(index, 1); next.splice(index + delta, 0, scene); save(next)
  }
  return <section className="real-session-board" aria-label="Доска сессии">
    <div className="real-session-board__toolbar"><strong>Доска сцен</strong><Button disabled={readonly} onClick={addScene}>Новая сцена</Button><Button onClick={() => void fitView({ padding: 0.2, maxZoom: 1 })}>Показать всё</Button><span role="status">{message || (readonly ? 'Завершённая сессия · только просмотр' : 'Перемещайте сцены за заголовок, объекты — за карточку.')}</span></div>
    <div className="real-session-board__workspace">
      <aside className="real-session-board__palette"><h3>Библиотека</h3><input aria-label="Найти объект для сцены" placeholder="Имя или тег…" value={query} onChange={(event) => setQuery(event.target.value)} /><label>Добавлять в сцену<select aria-label="Сцена для добавления объектов" value={targetId} onChange={(event) => { selectScene(event.target.value); selectToken(null) }}><option value="" disabled>Выберите сцену</option>{scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title}</option>)}</select></label><p>Нажмите «Добавить» или перетащите объект на сцену.</p>
        {entities.filter((entity) => `${entity.name} ${entity.tags.join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((entity) => <article key={entity.id} draggable={!readonly} onDragStart={(event) => { event.dataTransfer.setData('application/masterboard-entity', entity.id); event.dataTransfer.effectAllowed = 'copy' }}><strong>{entity.name}</strong><small>{TYPE_LABEL[entity.type] ?? entity.type}</small><Button size="sm" disabled={readonly || !targetId || !!scenes.find((scene) => scene.id === targetId)?.memberIds?.includes(entity.id)} aria-label={`Добавить ${entity.name} в сцену`} onClick={() => add(entity.id)}>Добавить</Button></article>)}
        {!entities.length && <p>Создайте персонажа, место или предмет в библиотеке кампании.</p>}
      </aside>
      <div ref={canvas} className="real-session-board__canvas" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }} onDrop={(event) => {
        event.preventDefault(); if (readonly) return
        const id = event.dataTransfer.getData('application/masterboard-entity'); if (!entities.some((entity) => entity.id === id)) return
        const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
        const target = [...scenes].reverse().find((scene) => { const base = scenePosition(scene, scenes.indexOf(scene)); const size = sceneSize(scene); return point.x >= base.x && point.x <= base.x + size.width && point.y >= base.y && point.y <= base.y + size.height })
        if (!target) { setMessage('Бросьте объект внутрь нужной сцены.'); return }
        const base = scenePosition(target, scenes.indexOf(target)); add(id, target.id, { x: point.x - base.x, y: point.y - base.y })
      }}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={changeNodes} onNodeDragStop={(_, node) => moveNode(node)} onNodeClick={(_, node) => { selectScene(node.type === 'scene' ? node.id : String(node.data.sceneId)); selectToken(node.type === 'token' ? { sceneId: String(node.data.sceneId), entityId: String(node.data.entityId) } : null) }} onConnect={connect} nodesDraggable={!readonly} nodesConnectable={!readonly} deleteKeyCode={null} fitView fitViewOptions={{ maxZoom: 1, padding: 0.2 }} minZoom={0.15} maxZoom={2} onPaneClick={() => selectToken(null)}><Background /><Controls showInteractive={false} /></ReactFlow>
      </div>
      <aside className="real-session-board__inspector"><h3>{selectedToken ? selectedEntity?.name ?? 'Удалённый объект' : selectedScene?.title ?? 'Выберите сцену'}</h3>
        {selectedToken ? <><p>{selectedEntity?.description}</p><label>Перенести в сцену<select aria-label="Перенести объект в сцену" disabled={readonly} value={selectedToken.sceneId} onChange={(event) => { const target = scenes.find((scene) => scene.id === event.target.value)!; if (save(moveSceneMember(scenes, selectedToken.sceneId, target.id, selectedToken.entityId, tokenPosition({ ...target, memberIds: [...(target.memberIds ?? []), selectedToken.entityId] }, selectedToken.entityId)))) { selectScene(target.id); selectToken({ ...selectedToken, sceneId: target.id }) } }}>{scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title}</option>)}</select></label><Button disabled={readonly} onClick={() => { if (save(removeSceneMember(scenes, selectedToken.sceneId, selectedToken.entityId))) selectToken(null) }}>Убрать со сцены</Button><p>Объект останется в библиотеке и на других сценах.</p></> : selectedScene && <>
          <label>Название сцены<input aria-label="Название сцены на доске" disabled={readonly} value={selectedScene.title} onChange={(event) => save(scenes.map((scene) => scene.id === selectedScene.id ? { ...scene, title: event.target.value } : scene))} /></label>
          <label>Задача сцены<textarea aria-label="Задача сцены на доске" disabled={readonly} value={selectedScene.purpose} onChange={(event) => save(scenes.map((scene) => scene.id === selectedScene.id ? { ...scene, purpose: event.target.value } : scene))} /></label>
          <div className="row"><Button disabled={readonly || scenes[0]?.id === targetId} onClick={() => reorder(-1)}>Раньше</Button><Button disabled={readonly || scenes.at(-1)?.id === targetId} onClick={() => reorder(1)}>Позже</Button></div><p>Порядок игры независим от расположения на доске.</p>
          <label>Переход к сцене<select aria-label="Следующая сцена" disabled={readonly} value={linkTarget} onChange={(event) => setLinkTarget(event.target.value)}><option value="">Выберите сцену</option>{scenes.filter((scene) => scene.id !== targetId).map((scene) => <option key={scene.id} value={scene.id}>{scene.title}</option>)}</select></label><Button disabled={readonly || !linkTarget || linkTarget === targetId || !scenes.some((scene) => scene.id === linkTarget)} onClick={() => connect({ source: targetId, target: linkTarget, sourceHandle: null, targetHandle: null })}>Добавить переход</Button>
          {(selectedScene.nextSceneIds ?? []).map((id) => <div key={id}><span>→ {scenes.find((scene) => scene.id === id)?.title ?? 'Удалённая сцена'}</span><Button size="sm" disabled={readonly} aria-label={`Удалить переход к ${scenes.find((scene) => scene.id === id)?.title ?? id}`} onClick={() => save(scenes.map((scene) => scene.id === targetId ? { ...scene, nextSceneIds: scene.nextSceneIds?.filter((next) => next !== id) } : scene))}>Убрать</Button></div>)}
          <Button disabled={readonly} tone="danger" onClick={() => { if (window.confirm('Удалить сцену и её размещения? Объекты останутся в библиотеке.') && save(removeBoardScene(scenes, selectedScene.id))) { selectScene(''); selectToken(null) } }}>Удалить сцену</Button>
        </>}
      </aside>
    </div>
  </section>
}
