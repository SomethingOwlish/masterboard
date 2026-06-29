// Relation board (M5 / B4, extended in B6): React Flow graph of every linkable
// entity — PCs, NPCs, Locations, Misc. Drag between nodes to connect; select an
// edge to label it, set direction, or delete. Node positions persist to
// relations.json. Clicking a node opens that entity's module.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
  MarkerType,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { NodePosition } from '../model/types'
import { KIND_GLYPH, KIND_MODULE, useEntityPool, type EntityKind } from '../store/entities'
import { useRelations } from '../store/relations'

interface NodeData extends Record<string, unknown> {
  label: string
  kind: EntityKind
}
type FlowNode = Node<NodeData>

/** Place nodes without a saved position evenly on a circle, spaced so wide
 *  name-nodes don't overlap as the roster grows. */
function circleLayout(i: number, total: number): NodePosition {
  const radius = 180 + total * 55
  const angle = (i / Math.max(1, total)) * 2 * Math.PI
  return { x: 400 + radius * Math.cos(angle), y: 360 + radius * Math.sin(angle) }
}

export function RelationsBoard() {
  const { campaignId } = useParams()
  const navigate = useNavigate()

  const entities = useEntityPool(campaignId)

  const relations = useRelations((s) => s.relations)
  const positions = useRelations((s) => s.positions)
  const addRelation = useRelations((s) => s.addRelation)
  const updateRelation = useRelations((s) => s.updateRelation)
  const removeRelation = useRelations((s) => s.removeRelation)
  const setPositions = useRelations((s) => s.setPositions)
  const pruneMissing = useRelations((s) => s.pruneMissing)

  const [nodes, setNodes] = useState<FlowNode[]>([])
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const rf = useRef<ReactFlowInstance<FlowNode, Edge> | null>(null)

  const kindOf = useMemo(() => {
    const m = new Map<string, EntityKind>()
    entities.forEach((e) => m.set(e.id, e.kind))
    return m
  }, [entities])

  // Drop relations/positions pointing at deleted entities once the pool loads.
  useEffect(() => {
    if (kindOf.size > 0) void pruneMissing(new Set(kindOf.keys()))
  }, [kindOf, pruneMissing])

  // Rebuild nodes when the entity set changes, preserving live drag positions.
  useEffect(() => {
    setNodes((prev) => {
      const live = new Map(prev.map((n) => [n.id, n.position]))
      return entities.map((e, i) => ({
        id: e.id,
        position: live.get(e.id) ?? positions[e.id] ?? circleLayout(i, entities.length),
        data: { label: `${KIND_GLYPH[e.kind]} ${e.name}`, kind: e.kind },
        className: `rf-node rf-${e.kind}`,
      }))
    })
  }, [entities, positions])

  const edges: Edge[] = useMemo(
    () =>
      relations.map((r) => ({
        id: r.id,
        source: r.fromId,
        target: r.toId,
        label: r.label || undefined,
        markerEnd: r.directed ? { type: MarkerType.ArrowClosed } : undefined,
        selected: r.id === selectedEdge,
      })),
    [relations, selectedEdge],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      setNodes((prev) => {
        const next = applyNodeChanges(changes, prev)
        // Persist once a drag finishes.
        if (changes.some((c) => c.type === 'position' && c.dragging === false)) {
          const pos: Record<string, NodePosition> = {}
          next.forEach((n) => (pos[n.id] = { x: n.position.x, y: n.position.y }))
          void setPositions(pos)
        }
        return next
      })
    },
    [setPositions],
  )

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target && c.source !== c.target) void addRelation({ fromId: c.source, toId: c.target })
    },
    [addRelation],
  )

  function autoLayout() {
    const pos: Record<string, NodePosition> = {}
    nodes.forEach((n, i) => (pos[n.id] = circleLayout(i, nodes.length)))
    setNodes((prev) => prev.map((n) => ({ ...n, position: pos[n.id] })))
    void setPositions(pos)
    requestAnimationFrame(() => rf.current?.fitView({ maxZoom: 1, padding: 0.25 }))
  }

  const selected = relations.find((r) => r.id === selectedEdge) ?? null
  const nameOf = (id: string) => entities.find((e) => e.id === id)?.name ?? '(unknown)'

  if (nodes.length === 0) {
    return (
      <div className="content">
        <h1 style={{ marginTop: 0 }}>
          <span aria-hidden>🕸️</span> Relations
        </h1>
        <p className="muted">
          Add some Characters, NPCs, Locations, or Misc objects first — they'll appear here as nodes to connect.
        </p>
      </div>
    )
  }

  return (
    <div className="content board-content">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>
          <span aria-hidden>🕸️</span> Relations
        </h1>
        <button onClick={autoLayout}>Auto-layout</button>
      </div>
      <p className="muted" style={{ marginTop: '0.25rem' }}>
        Drag from a node's edge to another to connect. Select an edge to label it, set direction, or delete.
        Click a node to open it.
      </p>

      <div className="board-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onConnect={onConnect}
          onEdgeClick={(_, edge) => setSelectedEdge(edge.id)}
          onPaneClick={() => setSelectedEdge(null)}
          onNodeClick={(_, node) => {
            const kind = kindOf.get(node.id)
            if (kind) navigate(`/campaign/${campaignId}/${KIND_MODULE[kind]}`)
          }}
          onInit={(inst) => (rf.current = inst)}
          fitView
          fitViewOptions={{ maxZoom: 1, padding: 0.25 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
        </ReactFlow>

        {selected && (
          <div className="edge-inspector card">
            <div className="muted" style={{ fontSize: '0.8rem' }}>
              {nameOf(selected.fromId)} {selected.directed ? '→' : '↔'} {nameOf(selected.toId)}
            </div>
            <input
              autoFocus
              value={selected.label}
              placeholder="label (e.g. rival)"
              onChange={(e) => void updateRelation(selected.id, { label: e.target.value })}
            />
            <label className="row" style={{ gap: '0.3rem', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={selected.directed}
                onChange={(e) => void updateRelation(selected.id, { directed: e.target.checked })}
              />
              directed
            </label>
            <button
              onClick={() => {
                void removeRelation(selected.id)
                setSelectedEdge(null)
              }}
            >
              Delete relation
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
