import { useMemo } from 'react'
import { Background, Controls, MarkerType, ReactFlow, type Connection, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useColorScheme } from '../../lib/useColorScheme'
import type { LocalCampaignRecord, LocalCampaignRelation, LocalRelationType } from '../../local/types'

const TYPE_COLOR: Record<LocalRelationType, string> = { alliance: 'var(--success)', enmity: 'var(--danger)', debt: 'var(--warning)', kin: 'var(--accent)', belongs: 'var(--text)', other: 'var(--line-strong, var(--border-strong))' }

function circle(index: number, total: number) {
  const radius = 160 + total * 40
  const angle = (index / Math.max(1, total)) * 2 * Math.PI
  return { x: 400 + radius * Math.cos(angle), y: 320 + radius * Math.sin(angle) }
}

interface Props {
  campaign: LocalCampaignRecord
  relations: LocalCampaignRelation[]
  onSelectRelation: (relation: LocalCampaignRelation) => void
  onConnect: (fromId: string, toId: string) => void
  onMoveNode: (entityId: string, position: { x: number; y: number }) => void
}

/** Graph view of world relations. Drag a node to place it, drag between nodes to add a relation. */
export default function RelationsGraph({ campaign, relations, onSelectRelation, onConnect, onMoveNode }: Props) {
  const colorMode = useColorScheme()
  const entities = useMemo(() => campaign.entities.filter((entity) => entity.status !== 'archived'), [campaign.entities])
  const nodes: Node[] = useMemo(() => entities.map((entity, index) => ({
    id: entity.id,
    position: campaign.relationLayout[entity.id] ?? circle(index, entities.length),
    data: { label: entity.name },
    className: 'relation-graph__node',
  })), [entities, campaign.relationLayout])
  const edges: Edge[] = useMemo(() => relations.map((relation) => ({
    id: relation.id,
    source: relation.fromId,
    target: relation.toId,
    label: relation.label,
    style: { stroke: TYPE_COLOR[relation.type], strokeWidth: 2.5, strokeDasharray: relation.visibility === 'master' ? '6 4' : undefined },
    markerEnd: { type: MarkerType.ArrowClosed, color: TYPE_COLOR[relation.type] },
    markerStart: relation.direction === 'mutual' ? { type: MarkerType.ArrowClosed, color: TYPE_COLOR[relation.type] } : undefined,
    labelBgStyle: { fill: 'var(--surface)' },
    labelStyle: { fill: 'var(--text)', fontWeight: 600 },
  })), [relations])

  return <div className="relation-graph" aria-label="Граф связей">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      colorMode={colorMode}
      fitView
      nodesConnectable
      onConnect={(connection: Connection) => { if (connection.source && connection.target && connection.source !== connection.target) onConnect(connection.source, connection.target) }}
      onEdgeClick={(_, edge) => { const relation = relations.find((item) => item.id === edge.id); if (relation) onSelectRelation(relation) }}
      onNodeDragStop={(_, node) => onMoveNode(node.id, { x: Math.round(node.position.x), y: Math.round(node.position.y) })}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls showInteractive={false} />
    </ReactFlow>
  </div>
}
