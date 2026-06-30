import * as React from 'react'

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Lucide icon name in kebab-case, e.g. "dices", "map-pin", "waypoints". */
  name: string
  /** Pixel size of the square glyph. Default 20. */
  size?: number
  className?: string
}

/** Renders a Lucide glyph by name. Requires the Lucide UMD script on the page. */
export function Icon(props: IconProps): React.ReactElement
