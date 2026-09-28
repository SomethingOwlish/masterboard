import { useEffect } from 'react'

export const APP_TITLE = 'Мастерборд'

/** Tab title from the most specific part to the app: «Библиотека · Порт · Мастерборд» (ТЗ-3, этап 6). */
export const documentTitle = (...parts: Array<string | undefined>): string => [...parts.filter(Boolean), APP_TITLE].join(' · ')

export function useDocumentTitle(...parts: Array<string | undefined>): void {
  const title = documentTitle(...parts)
  useEffect(() => { document.title = title }, [title])
}
