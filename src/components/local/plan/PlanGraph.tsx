import { useMemo } from 'react'
import { Background, Controls, MarkerType, ReactFlow, type Connection, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useColorScheme } from '../../../lib/useColorScheme'
import { addFlow } from '../../../local/plan'
import type { PlanApi } from './planApi'

/** Transitions graph: plan items as nodes, flows as edges; "or" groups share a tinted frame. */
export default function PlanGraph({ api }: { api: PlanApi }) {
  const colorMode = useColorScheme()
  const { session } = api
  const groups = useMemo(() => [...new Set(session.planItems.map((item) => item.alternative.trim()).filter(Boolean))], [session.planItems])
  const nodes: Node[] = useMemo(() => session.planItems.map((item, index) => {
    const group = item.alternative.trim()
    return {
      id: item.id,
      position: session.planLayout[item.id] ?? { x: 60 + (index % 4) * 240, y: 40 + Math.floor(index / 4) * 150 },
      data: { label: group ? `${api.itemTitle(item)}\nили: ${group}` : api.itemTitle(item) },
      className: `plan-graph__node plan-graph__node--${item.kind}${group ? ` plan-graph__node--alt plan-graph__node--alt-${groups.indexOf(group) % 4}` : ''}${item.status === 'used' ? ' plan-graph__node--used' : ''}`,
    }
  }), [session.planItems, session.planLayout, groups, api])
  const edges: Edge[] = useMemo(() => session.flows.map((flow) => ({
    id: flow.id, source: flow.fromItemId, target: flow.toItemId, label: flow.condition || undefined,
    markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 2 }, labelBgStyle: { fill: 'var(--surface)' }, labelStyle: { fill: 'var(--text)' },
  })), [session.flows])

  return <div className="relation-graph plan-graph" aria-label="Граф переходов">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      colorMode={colorMode}
      fitView
      onConnect={(connection: Connection) => { if (connection.source && connection.target) api.update(addFlow(session, connection.source, connection.target, '')) }}
      onEdgesDelete={(deleted) => api.update({ ...session, flows: session.flows.filter((flow) => !deleted.some((edge) => edge.id === flow.id)) })}
      onNodeDoubleClick={(_, node) => api.editItem(node.id)}
      onNodeDragStop={(_, node) => api.update({ ...session, planLayout: { ...session.planLayout, [node.id]: { x: Math.round(node.position.x), y: Math.round(node.position.y) } } })}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls showInteractive={false} />
    </ReactFlow>
  </div>
}
