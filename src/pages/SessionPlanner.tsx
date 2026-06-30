// Session planner board (M7 / B11). Rebuilt off tldraw onto React Flow plus a
// custom annotation layer. Scenes are resizable container nodes; the palette drops
// entity tokens (live references) that become a scene's React Flow children when
// they sit inside it; arrows connect nodes for scene-to-scene flow. On top of all
// that, the DrawLayer adds freehand ink (pen, highlighter, shapes, text, free
// arrows, stickers) that floats in canvas space. The whole board persists as our
// own JSON in SessionDoc.canvas (see lib/board), and Scenes are derived from the
// nodes on every save so Print (B9) keeps reading structured data.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { TouchHint } from '../components/TouchHint'
import { useConfirm } from '../components/useConfirm'
import { useChronology } from '../store/chronology'
import { useEntityPool } from '../store/entities'
import { sessionTitle, useSessions } from '../store/sessions'
import { Button, Checkbox, GlassPanel, Icon, TextField } from '../ds'
import { newId } from '../model/ids'
import {
  deriveScenes,
  loadBoard,
  SCENE_DEFAULT,
  TOKEN_ICON,
  type BoardState,
  type DrawTool,
  type Drawing,
  type Point,
  type SerEdge,
  type SerNode,
  type ShapeKind,
  type TokenKind,
} from '../lib/board'
import { SceneNode, type SceneData } from '../components/planner/SceneNode'
import { TokenNode, type TokenData } from '../components/planner/TokenNode'
import { DrawLayer } from '../components/planner/DrawLayer'
import { PlannerToolbar } from '../components/planner/PlannerToolbar'

type FlowNode = Node

const NODE_TYPES = { scene: SceneNode, token: TokenNode }

const EDGE_STYLE = { strokeWidth: 2.5, stroke: 'var(--line-strong)' } as const
const EDGE_LABEL_BG = { fill: 'var(--surface)', stroke: 'var(--line-strong)', strokeWidth: 1 } as const
const EDGE_LABEL_TEXT = { fill: 'var(--text)', fontWeight: 600, fontFamily: 'var(--font-sans)' } as const

interface PaletteItem {
  id: string
  name: string
  kind: TokenKind
}

// Scenes must precede their token children in the array (React Flow parent rule).
function sortNodes(ns: FlowNode[]): FlowNode[] {
  return [...ns].sort((a, b) => (a.type === 'scene' ? 0 : 1) - (b.type === 'scene' ? 0 : 1))
}

function sceneSize(n: FlowNode): { w: number; h: number } {
  const d = n.data as SceneData
  return { w: d.w ?? SCENE_DEFAULT.w, h: d.h ?? SCENE_DEFAULT.h }
}

/** Absolute (page) position of a node, resolving one level of scene parenting. */
function absPos(n: FlowNode, all: FlowNode[]): Point {
  if (!n.parentId) return n.position
  const p = all.find((x) => x.id === n.parentId)
  return p ? { x: p.position.x + n.position.x, y: p.position.y + n.position.y } : n.position
}

/** Topmost scene whose rectangle contains a page-space point, if any. */
function sceneAt(pt: Point, all: FlowNode[]): FlowNode | undefined {
  let found: FlowNode | undefined
  for (const s of all) {
    if (s.type !== 'scene') continue
    const { w, h } = sceneSize(s)
    if (pt.x >= s.position.x && pt.x <= s.position.x + w && pt.y >= s.position.y && pt.y <= s.position.y + h) found = s
  }
  return found
}

function toFlowNode(n: SerNode): FlowNode {
  if (n.type === 'scene') {
    const w = n.w ?? SCENE_DEFAULT.w
    const h = n.h ?? SCENE_DEFAULT.h
    return {
      id: n.id,
      type: 'scene',
      position: { x: n.x, y: n.y },
      data: { name: n.name ?? 'New scene', w, h } satisfies SceneData,
      style: { width: w, height: h },
    }
  }
  return {
    id: n.id,
    type: 'token',
    position: { x: n.x, y: n.y },
    parentId: n.parentId,
    data: { entityId: n.entityId ?? '', entityKind: (n.entityKind ?? 'misc') as TokenKind, name: '', missing: false } satisfies TokenData,
  }
}

function toFlowEdge(e: SerEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label || undefined,
    data: { directed: !!e.directed },
    markerEnd: e.directed ? { type: MarkerType.ArrowClosed, color: 'var(--line-strong)', width: 18, height: 18 } : undefined,
    style: EDGE_STYLE,
    labelShowBg: true,
    labelBgStyle: EDGE_LABEL_BG,
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 9,
    labelStyle: EDGE_LABEL_TEXT,
  }
}

function serialize(nodes: FlowNode[], edges: Edge[], drawings: Drawing[]): BoardState {
  return {
    v: 2,
    nodes: nodes.map((n): SerNode => {
      if (n.type === 'scene') {
        const d = n.data as SceneData
        return { id: n.id, type: 'scene', x: n.position.x, y: n.position.y, name: d.name, w: d.w, h: d.h }
      }
      const d = n.data as TokenData
      return { id: n.id, type: 'token', x: n.position.x, y: n.position.y, parentId: n.parentId, entityId: d.entityId, entityKind: d.entityKind }
    }),
    edges: edges.map((e): SerEdge => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === 'string' ? e.label : undefined,
      directed: !!(e.data as { directed?: boolean } | undefined)?.directed,
    })),
    drawings,
  }
}

function PlannerInner({ campaignId }: { campaignId: string }) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const current = useSessions((s) => s.current)
  const updateMeta = useSessions((s) => s.updateMeta)
  const saveCurrent = useSessions((s) => s.saveCurrent)
  const remove = useSessions((s) => s.remove)

  const pool = useEntityPool(campaignId)
  const events = useChronology((s) => s.events)
  const loadChrono = useChronology((s) => s.load)
  useEffect(() => {
    void loadChrono(campaignId)
  }, [campaignId, loadChrono])

  const { screenToFlowPosition } = useReactFlow()
  const canvasRef = useRef<HTMLDivElement>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)

  const [tool, setTool] = useState<DrawTool>('select')
  const [color, setColor] = useState('#ef4444')
  const [width, setWidth] = useState(4)
  const [shapeKind, setShapeKind] = useState<ShapeKind>('rectangle')
  const [sticker, setSticker] = useState('☠️')

  const lastSaved = useRef('')

  // Build the board once on mount (this component is keyed by session id, so it
  // remounts when you switch sessions). Old tldraw canvases load as empty.
  useEffect(() => {
    const board = loadBoard(useSessions.getState().current?.canvas)
    setNodes(sortNodes(board.nodes.map(toFlowNode)))
    setEdges(board.edges.map(toFlowEdge))
    setDrawings(board.drawings)
    lastSaved.current = JSON.stringify(board)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resolve live entity names onto tokens; flag tokens whose entity was deleted.
  const nameOf = useCallback(
    (id: string, kind: TokenKind): string | undefined => {
      if (kind === 'event') {
        const e = events.find((ev) => ev.id === id)
        return e ? e.title || e.date || '(event)' : undefined
      }
      return pool.find((p) => p.id === id)?.name
    },
    [pool, events],
  )

  useEffect(() => {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.type !== 'token') return n
        const d = n.data as TokenData
        const nm = nameOf(d.entityId, d.entityKind)
        return { ...n, data: { ...d, name: nm ?? d.name, missing: nm === undefined } }
      }),
    )
  }, [nameOf, setNodes])

  // Debounced persist of the board + derived scenes; skips redundant writes.
  useEffect(() => {
    const t = setTimeout(() => {
      const board = serialize(nodes, edges, drawings)
      const json = JSON.stringify(board)
      if (json === lastSaved.current) return
      lastSaved.current = json
      void saveCurrent({ canvas: board, scenes: deriveScenes(board.nodes) })
    }, 600)
    return () => clearTimeout(t)
  }, [nodes, edges, drawings, saveCurrent])

  // Re-parent a token to whichever scene it was dropped into (or none).
  const onNodeDragStop = useCallback(
    (_: MouseEvent | TouchEvent, node: FlowNode) => {
      if (node.type !== 'token') return
      setNodes((ns) => {
        const me = ns.find((n) => n.id === node.id)
        if (!me) return ns
        const abs = absPos(me, ns)
        const scene = sceneAt(abs, ns)
        const newParent = scene?.id
        if ((newParent ?? '') === (me.parentId ?? '')) return ns
        const base = scene ? scene.position : { x: 0, y: 0 }
        return sortNodes(
          ns.map((n) =>
            n.id === node.id ? { ...n, parentId: newParent, position: { x: abs.x - base.x, y: abs.y - base.y } } : n,
          ),
        )
      })
    },
    [setNodes],
  )

  // When a scene is deleted, re-absolute its orphaned tokens so they don't vanish.
  const onNodesDelete = useCallback(
    (deleted: FlowNode[]) => {
      const goneScenes = new Map(deleted.filter((n) => n.type === 'scene').map((s) => [s.id, s.position]))
      if (!goneScenes.size) return
      setNodes((ns) =>
        ns.map((n) => {
          const sp = n.parentId ? goneScenes.get(n.parentId) : undefined
          return sp ? { ...n, parentId: undefined, position: { x: sp.x + n.position.x, y: sp.y + n.position.y } } : n
        }),
      )
    },
    [setNodes],
  )

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target && c.source !== c.target) {
        setEdges((es) => addEdge(toFlowEdge({ id: newId('edge'), source: c.source, target: c.target, directed: true }), es))
      }
    },
    [setEdges],
  )

  const centerFlow = useCallback((): Point => {
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r) return { x: 0, y: 0 }
    return screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
  }, [screenToFlowPosition])

  function dropToken(item: PaletteItem) {
    const c = centerFlow()
    setNodes((ns) => {
      const scene = sceneAt(c, ns)
      const node: FlowNode = {
        id: newId('node'),
        type: 'token',
        position: scene ? { x: c.x - scene.position.x, y: c.y - scene.position.y } : c,
        parentId: scene?.id,
        data: { entityId: item.id, entityKind: item.kind, name: item.name, missing: false } satisfies TokenData,
      }
      return sortNodes([...ns, node])
    })
  }

  function addScene() {
    const c = centerFlow()
    const { w, h } = SCENE_DEFAULT
    const node: FlowNode = {
      id: newId('node'),
      type: 'scene',
      position: { x: c.x - w / 2, y: c.y - h / 2 },
      data: { name: 'New scene', w, h } satisfies SceneData,
      style: { width: w, height: h },
    }
    setNodes((ns) => sortNodes([node, ...ns]))
  }

  const onClearInk = () => {
    if (!drawings.length) return
    confirm({
      title: 'Clear all ink?',
      message: 'Remove every freehand drawing on this board? Scenes, tokens and arrows are kept.',
      confirmLabel: 'Clear',
      onConfirm: () => setDrawings([]),
    })
  }

  const updateEdge = (id: string, patch: { label?: string; directed?: boolean }) => {
    setEdges((es) =>
      es.map((e) => {
        if (e.id !== id) return e
        const directed = patch.directed ?? (e.data as { directed?: boolean })?.directed ?? false
        return {
          ...e,
          label: patch.label ?? e.label,
          data: { ...(e.data as object), directed },
          markerEnd: directed ? { type: MarkerType.ArrowClosed, color: 'var(--line-strong)', width: 18, height: 18 } : undefined,
        }
      }),
    )
  }

  const groups: { label: string; items: PaletteItem[] }[] = useMemo(
    () => [
      { label: 'Players', items: pool.filter((e) => e.kind === 'pc').map((e) => ({ id: e.id, name: e.name, kind: 'pc' as TokenKind })) },
      { label: 'NPCs', items: pool.filter((e) => e.kind === 'npc').map((e) => ({ id: e.id, name: e.name, kind: 'npc' as TokenKind })) },
      { label: 'Locations', items: pool.filter((e) => e.kind === 'location').map((e) => ({ id: e.id, name: e.name, kind: 'location' as TokenKind })) },
      { label: 'Misc', items: pool.filter((e) => e.kind === 'misc').map((e) => ({ id: e.id, name: e.name, kind: 'misc' as TokenKind })) },
      { label: 'Events', items: events.map((e) => ({ id: e.id, name: e.title || e.date || '(event)', kind: 'event' as TokenKind })) },
    ],
    [pool, events],
  )

  const selected = edges.find((e) => e.id === selectedEdge)
  const nodeName = (id?: string) => (nodes.find((n) => n.id === id)?.data as TokenData | SceneData | undefined)?.name ?? '—'

  if (!current) {
    return (
      <div className="content">
        <p className="muted">Loading session…</p>
      </div>
    )
  }

  const appTheme = document.documentElement.getAttribute('data-theme')
  const colorScheme = appTheme && appTheme !== 'parchment' ? 'dark' : 'light'
  const selectMode = tool === 'select'

  return (
    <div className="planner-page">
      <div className="planner-head no-print">
        <button className="ghost" onClick={() => navigate(`/campaign/${campaignId}/sessions`)} title="Back to sessions">
          ← Sessions
        </button>
        <input
          className="planner-name"
          value={current.name}
          placeholder="Session name"
          onChange={(e) => void updateMeta(current.id, { name: e.target.value })}
        />
        <input type="date" value={current.realDate} onChange={(e) => void updateMeta(current.id, { realDate: e.target.value })} />
        <span className="muted">#{current.seq}</span>
        <span style={{ flex: 1 }} />
        <button onClick={addScene}>+ Scene</button>
        <button
          className="ghost"
          onClick={() =>
            confirm({
              title: 'Delete session?',
              message: `Delete session ${sessionTitle(current)}? This can't be undone.`,
              confirmLabel: 'Delete',
              tone: 'danger',
              onConfirm: () => {
                void remove(current.id)
                navigate(`/campaign/${campaignId}/sessions`)
              },
            })
          }
        >
          Delete
        </button>
      </div>

      <div className="planner-body">
        <aside className="planner-palette no-print">
          <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.82rem' }}>
            Click to drop a linked token onto the board. Drag it into a scene to add it there.
          </p>
          {groups.map((g) => (
            <div key={g.label} className="palette-group">
              <h3 className="palette-title">{g.label}</h3>
              {g.items.length === 0 ? (
                <p className="muted palette-empty">None yet.</p>
              ) : (
                g.items.map((item) => (
                  <button key={item.id} className="palette-item row" style={{ gap: '0.4rem' }} onClick={() => dropToken(item)}>
                    <Icon name={TOKEN_ICON[item.kind] ?? 'dices'} size={15} /> {item.name}
                  </button>
                ))
              )}
            </div>
          ))}
        </aside>

        <div className="planner-canvas" ref={canvasRef}>
          <TouchHint text="Pinch to zoom · drag to pan · pick a tool to draw" />
          <PlannerToolbar
            tool={tool}
            setTool={setTool}
            color={color}
            setColor={setColor}
            width={width}
            setWidth={setWidth}
            shapeKind={shapeKind}
            setShapeKind={setShapeKind}
            sticker={sticker}
            setSticker={setSticker}
            canUndo={drawings.length > 0}
            onUndo={() => setDrawings((ds) => ds.slice(0, -1))}
            onClearInk={onClearInk}
          />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodesDelete={onNodesDelete}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onEdgeClick={(_, e) => setSelectedEdge(e.id)}
            onPaneClick={() => setSelectedEdge(null)}
            nodesDraggable={selectMode}
            nodesConnectable={selectMode}
            elementsSelectable={selectMode}
            panOnDrag={selectMode}
            zoomOnScroll={selectMode}
            colorMode={colorScheme}
            proOptions={{ hideAttribution: true }}
            fitView
            fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>

          <DrawLayer
            active={!selectMode}
            tool={tool}
            color={color}
            width={width}
            shapeKind={shapeKind}
            sticker={sticker}
            drawings={drawings}
            onCommit={(d) => setDrawings((ds) => [...ds, d])}
            onErase={(ids) => setDrawings((ds) => ds.filter((d) => !ids.includes(d.id)))}
          />

          {selected && (
            <GlassPanel className="edge-inspector" padding="var(--space-4)">
              <div className="mb-data" style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                {nodeName(selected.source)} {(selected.data as { directed?: boolean })?.directed ? '→' : '↔'} {nodeName(selected.target)}
              </div>
              <TextField
                autoFocus
                value={typeof selected.label === 'string' ? selected.label : ''}
                placeholder="label (e.g. then →)"
                onChange={(e) => updateEdge(selected.id, { label: e.target.value })}
              />
              <Checkbox
                label="Directed"
                checked={!!(selected.data as { directed?: boolean })?.directed}
                onChange={(e) => updateEdge(selected.id, { directed: e.target.checked })}
              />
              <Button
                variant="soft"
                tone="danger"
                icon="trash-2"
                block
                onClick={() => {
                  setEdges((es) => es.filter((e) => e.id !== selected.id))
                  setSelectedEdge(null)
                }}
              >
                Delete arrow
              </Button>
            </GlassPanel>
          )}
        </div>
      </div>
    </div>
  )
}

export function SessionPlanner() {
  const { campaignId, sessionId } = useParams()
  const open = useSessions((s) => s.open)
  const current = useSessions((s) => s.current)

  useEffect(() => {
    if (campaignId && sessionId) void open(campaignId, sessionId)
  }, [campaignId, sessionId, open])

  if (!current || !campaignId) {
    return (
      <div className="content">
        <p className="muted">Loading session…</p>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <PlannerInner key={current.id} campaignId={campaignId} />
    </ReactFlowProvider>
  )
}
