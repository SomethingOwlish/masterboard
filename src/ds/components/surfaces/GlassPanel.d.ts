import * as React from 'react'

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stronger blur for full-screen veils/scrims. */
  veil?: boolean
  padding?: string
  radius?: string
  children?: React.ReactNode
}

export function GlassPanel(props: GlassPanelProps): React.ReactElement
