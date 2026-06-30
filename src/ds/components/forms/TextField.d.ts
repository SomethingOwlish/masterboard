import * as React from 'react'

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  /** Leading Lucide icon name (single-line only). */
  icon?: string
  /** Render a <textarea> instead of <input>. */
  multiline?: boolean
  rows?: number
  invalid?: boolean
  containerStyle?: React.CSSProperties
}

export function TextField(props: TextFieldProps): React.ReactElement
