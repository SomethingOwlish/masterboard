// A Scene on the session board (B11): a resizable container node. Entity tokens
// dropped inside it become its React Flow children, and Print reads those as the
// scene's members. The header holds an inline-editable name; both name edits and
// resize write straight back into the node via React Flow's data API.

import { Handle, NodeResizer, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { Icon } from '../../ds'

export interface SceneData extends Record<string, unknown> {
  name: string
  w: number
  h: number
}

export function SceneNode({ id, data, selected }: NodeProps) {
  const d = data as SceneData
  const { updateNodeData } = useReactFlow()

  return (
    <div className="scene-node">
      <NodeResizer
        minWidth={180}
        minHeight={130}
        isVisible={!!selected}
        lineClassName="scene-resize-line"
        handleClassName="scene-resize-handle"
        onResize={(_, p) => updateNodeData(id, { w: p.width, h: p.height })}
      />
      {/* Connect scenes to one another to map scene-to-scene flow. */}
      <Handle type="target" position={Position.Left} className="scene-handle" />
      <Handle type="source" position={Position.Right} className="scene-handle" />
      <div className="scene-node-head">
        <Icon name="clapperboard" size={14} />
        <input
          className="scene-node-name"
          value={d.name}
          placeholder="Scene"
          aria-label="Scene name"
          // Keep typing/selection from being swallowed as a node drag.
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => updateNodeData(id, { name: e.target.value })}
        />
      </div>
    </div>
  )
}
