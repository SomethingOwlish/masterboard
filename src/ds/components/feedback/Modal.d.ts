import * as React from 'react'

export interface ModalProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  open?: boolean
  onClose?: () => void
  title?: string
  subtitle?: string
  /** Small uppercase line above the title. Only when given — there is no default. */
  kicker?: string
  /** Leading Lucide icon shown in a tinted tile. */
  icon?: string
  /** sm 380 · md 480 · lg 620 · xl 820 · full 980 (max width, px). */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** Footer node(s) — typically Buttons. */
  footer?: React.ReactNode
  /** Allow Escape / scrim-click / «×» to close. Default true. */
  dismissable?: boolean
  /** Unsaved edits: Escape, scrim-click and «×» ask «Закрыть без сохранения?» first. */
  dirty?: boolean
  /** Element to focus on open. Default: an `autoFocus` field, else the first field, else the first control. */
  initialFocus?: React.RefObject<HTMLElement | null>
  /** Accessible name of the «×» button. Default «Закрыть». */
  closeLabel?: string
  className?: string
  children?: React.ReactNode
  style?: React.CSSProperties
}

export function Modal(props: ModalProps): React.ReactElement | null
