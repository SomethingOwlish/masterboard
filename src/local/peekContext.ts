import { createContext, useContext } from 'react'
import type { PeekTarget } from './search'

export interface PeekApi {
  open: (target: PeekTarget) => void
  /** Opens the campaign search (Ctrl+K). */
  search: () => void
}

export const PeekContext = createContext<PeekApi | null>(null)

/** Side panel of the campaign page; outside it (tests of a lone section) names stay plain text. */
export const usePeek = () => useContext(PeekContext)

/** How the search shortcut is written on this platform. */
export const searchShortcut = () => /Mac|iPhone|iPad/.test(typeof navigator === 'undefined' ? '' : navigator.userAgent) ? '⌘K' : 'Ctrl K'
