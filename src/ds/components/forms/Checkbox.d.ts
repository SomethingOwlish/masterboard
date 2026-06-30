import * as React from 'react'

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean
  onChange?: React.ChangeEventHandler<HTMLInputElement>
  label?: string
  hint?: string
  disabled?: boolean
}

export function Checkbox(props: CheckboxProps): React.ReactElement
