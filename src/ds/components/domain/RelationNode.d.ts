import * as React from 'react'

export interface Point { x: number; y: number }

export interface RelationNodeProps extends React.HTMLAttributes<HTMLButtonElement> {
  name: string
  kind?: 'pc' | 'npc'
  dead?: boolean
  selected?: boolean
  onClick?: () => void
}

export function RelationNode(props: RelationNodeProps): React.ReactElement

export interface RelationEdgeProps {
  from: Point
  to: Point
  label?: string
  /** Show an arrowhead for directed relations. */
  directed?: boolean
  id?: string
  /** Accent-colour + thicken the line (selection/hover). */
  highlighted?: boolean
  /** Fill behind the label chip (match the board ground). */
  labelBg?: string
}

/** Render inside an SVG overlay positioned over the relation board. */
export function RelationEdge(props: RelationEdgeProps): React.ReactElement
