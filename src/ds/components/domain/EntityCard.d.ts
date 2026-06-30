import * as React from 'react'

export interface EntityCardProps extends React.HTMLAttributes<HTMLButtonElement> {
  name: string
  /** Secondary line — e.g. player name. Hidden when dead (shows a Dead badge). */
  secondary?: string
  portrait?: string
  kind?: 'pc' | 'npc'
  dead?: boolean
  tags?: string[]
  onClick?: () => void
}

export function EntityCard(props: EntityCardProps): React.ReactElement
