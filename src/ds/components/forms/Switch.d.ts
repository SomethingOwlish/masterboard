import * as React from 'react'

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean
  onChange?: React.ChangeEventHandler<HTMLInputElement>
  label?: string
  disabled?: boolean
}

export function Switch(props: SwitchProps): React.ReactElement
