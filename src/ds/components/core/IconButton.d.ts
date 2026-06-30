import * as React from 'react'

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** Lucide icon name. */
  icon: string
  /** Accessible label (also the tooltip). */
  label: string
  variant?: 'ghost' | 'solid' | 'soft'
  size?: 'sm' | 'md' | 'lg'
  tone?: 'default' | 'accent' | 'danger'
  disabled?: boolean
}

export function IconButton(props: IconButtonProps): React.ReactElement
