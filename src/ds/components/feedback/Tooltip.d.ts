import * as React from 'react'

export interface TooltipProps {
  label: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: React.ReactNode
  style?: React.CSSProperties
}

export function Tooltip(props: TooltipProps): React.ReactElement
