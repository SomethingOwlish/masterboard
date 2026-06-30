import * as React from 'react'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  invalid?: boolean
  containerStyle?: React.CSSProperties
  children?: React.ReactNode
}

export function Select(props: SelectProps): React.ReactElement
