import * as React from 'react'

/**
 * Primary action control for Masterboard.
 */
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: 'primary' | 'secondary' | 'soft' | 'ghost' | 'outline'
  tone?: 'accent' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  /** Leading Lucide icon name. */
  icon?: string
  /** Trailing Lucide icon name. */
  iconRight?: string
  block?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  children?: React.ReactNode
}

export function Button(props: ButtonProps): React.ReactElement
