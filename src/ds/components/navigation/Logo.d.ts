import * as React from 'react'

export interface LogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg'
  /** Render the d6 seal tile only, without the wordmark. */
  mark?: boolean
}

export function Logo(props: LogoProps): React.ReactElement
