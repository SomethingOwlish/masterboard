import * as React from 'react'

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** Hover lift + accent border. Use for clickable tiles & entity cards. */
  interactive?: boolean
  /** Frost the surface (translucent + backdrop blur). */
  glass?: boolean
  /** Overlay a texture: 'dots' | 'grid' | 'hatch' | 'paper' | 'weave'. */
  pattern?: 'dots' | 'grid' | 'hatch' | 'paper' | 'weave'
  padding?: string
  as?: keyof JSX.IntrinsicElements
  children?: React.ReactNode
}

export function Card(props: CardProps): React.ReactElement
