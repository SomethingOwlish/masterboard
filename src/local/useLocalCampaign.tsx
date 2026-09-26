import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { IdbStorageGateway } from '../adapters/idbStorageGateway'
import { createLocalCampaignCatalog, type LocalCampaignCatalog } from './catalog'
import type { LocalCampaignRecord } from './types'

let defaultCatalog: LocalCampaignCatalog | null = null
function browserCatalog(): LocalCampaignCatalog {
  defaultCatalog ??= createLocalCampaignCatalog(new IdbStorageGateway(), { legacyStorage: window.localStorage })
  return defaultCatalog
}

const CatalogContext = createContext<LocalCampaignCatalog | null>(null)

export function LocalCatalogProvider({ catalog, children }: { catalog: LocalCampaignCatalog; children: ReactNode }) {
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>
}

export function useLocalCatalog(): LocalCampaignCatalog {
  return useContext(CatalogContext) ?? browserCatalog()
}

export type LocalCampaignState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; campaign: LocalCampaignRecord; persist: (next: LocalCampaignRecord) => void; saveError: string | null; retry: () => void }

/**
 * Loads one campaign and saves edits. The screen updates immediately; writes
 * run one at a time, and only the newest pending version is written. A failed
 * write keeps the edit on screen and exposes `saveError` + `retry`.
 */
export function useLocalCampaign(id: string): LocalCampaignState {
  const catalog = useLocalCatalog()
  const [campaign, setCampaign] = useState<LocalCampaignRecord | null | undefined>(undefined)
  const [saveError, setSaveError] = useState<string | null>(null)
  const pending = useRef<LocalCampaignRecord | null>(null)
  const writing = useRef(false)

  useEffect(() => {
    let alive = true
    setCampaign(undefined)
    catalog.find(id).then((found) => { if (alive) setCampaign(found) }, () => { if (alive) setCampaign(null) })
    return () => { alive = false }
  }, [catalog, id])

  const flush = useCallback(async () => {
    if (writing.current) return
    writing.current = true
    try {
      while (pending.current) {
        const next = pending.current
        pending.current = null
        try {
          await catalog.update(next)
          setSaveError(null)
        } catch (error) {
          pending.current ??= next
          setSaveError(error instanceof Error ? error.message : 'Не удалось сохранить изменения')
          return
        }
      }
    } finally {
      writing.current = false
    }
  }, [catalog])

  const persist = useCallback((next: LocalCampaignRecord) => {
    setCampaign(next)
    pending.current = next
    void flush()
  }, [flush])

  const retry = useCallback(() => { void flush() }, [flush])

  if (campaign === undefined) return { status: 'loading' }
  if (campaign === null) return { status: 'missing' }
  return { status: 'ready', campaign, persist, saveError, retry }
}
