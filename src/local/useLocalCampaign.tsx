import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { IdbStorageGateway } from '../adapters/idbStorageGateway'
import { createLocalCampaignCatalog, type LocalCampaignCatalog } from './catalog'
import { applyMine, type MergeConflict } from './merge'
import { forgetCampaign, rememberCampaign } from './latestCampaign'
import { SERVER_POLL_MS, SharedConflictError, type CampaignCatalog } from './remote'
import type { LocalCampaignRecord } from './types'

let defaultCatalog: LocalCampaignCatalog | null = null
export function browserCatalog(): LocalCampaignCatalog {
  defaultCatalog ??= createLocalCampaignCatalog(new IdbStorageGateway(), { legacyStorage: window.localStorage })
  return defaultCatalog
}

const CatalogContext = createContext<CampaignCatalog | null>(null)

export function LocalCatalogProvider({ catalog, children }: { catalog: CampaignCatalog; children: ReactNode }) {
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>
}

export function useLocalCatalog(): CampaignCatalog {
  return useContext(CatalogContext) ?? browserCatalog()
}

export type LocalCampaignState =
  | { status: 'loading' }
  | { status: 'missing' }
  | {
    status: 'ready'
    campaign: LocalCampaignRecord
    persist: (next: LocalCampaignRecord) => void
    saveError: string | null
    /** Sends unsaved edits now (the «Синхронизировать» button). */
    retry: () => void
    /** The unsaved edits are kept in this browser and survive a reload. */
    savedInBrowser: boolean
    /** Places both masters changed; the other master's version is on screen until the master picks «моя». */
    conflicts: CampaignConflicts | null
    /** Keeps «my» value at the given conflict paths (the rest stay as the other master left them). */
    resolveConflicts: (mine: string[]) => void
  }

export interface CampaignConflicts { items: MergeConflict[]; by?: string }

/**
 * Loads one campaign and saves edits. The screen updates immediately; writes
 * run one at a time, and only the newest pending version is written. For a
 * server campaign the write waits `saveDelayMs` after the last edit (one
 * database write per burst of typing), and until the server takes it the edit
 * is kept in the browser as a draft: a lost connection or a reload does not
 * lose it, it is sent when the connection returns or on «Синхронизировать».
 * A failed write keeps the edit on screen and exposes `saveError` + `retry`.
 * A shared campaign may come back merged with another master's edits; the
 * merged version replaces the screen unless newer edits are already queued,
 * and the places both masters changed wait in `conflicts` for a choice.
 * While the tab is visible and nothing is waiting to be written, an open
 * shared campaign asks the server every `pollMs` whether another master
 * saved, and shows their version.
 */
export function useLocalCampaign(id: string): LocalCampaignState {
  const catalog = useLocalCatalog()
  const [campaign, setCampaign] = useState<LocalCampaignRecord | null | undefined>(undefined)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<CampaignConflicts | null>(null)
  const [savedInBrowser, setSavedInBrowser] = useState(false)
  const pending = useRef<LocalCampaignRecord | null>(null)
  const writing = useRef(false)
  const timer = useRef<number | null>(null)
  const shared = catalog.shared
  const drafts = shared?.drafts
  const delay = shared?.saveDelayMs ?? 0

  useEffect(() => { if (campaign) rememberCampaign(campaign) }, [campaign])
  useEffect(() => () => forgetCampaign(id), [id])

  const flush = useCallback(async () => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null }
    if (writing.current) return
    writing.current = true
    try {
      while (pending.current) {
        const next = pending.current
        pending.current = null
        try {
          const saved = await catalog.update(next)
          if (!pending.current && shared?.isShared(saved.id)) setCampaign(saved)
          setSaveError(null)
        } catch (error) {
          const saved = (error as { saved?: LocalCampaignRecord }).saved
          if (saved) {
            if (!pending.current) setCampaign(saved)
            if (error instanceof SharedConflictError) {
              const fresh = error.conflicts
              setConflicts((prev) => ({ by: error.by ?? prev?.by, items: [...(prev?.items ?? []).filter((item) => !fresh.some((next) => next.path === item.path)), ...fresh] }))
            }
            continue
          }
          pending.current ??= next
          setSaveError(error instanceof Error ? error.message : 'Не удалось сохранить изменения')
          return
        }
      }
      if (drafts) { await drafts.remove(id).catch(() => undefined); if (!pending.current) setSavedInBrowser(false) }
    } finally {
      writing.current = false
    }
    if (pending.current) void flush()
  }, [catalog, shared, drafts, id])

  useEffect(() => {
    let alive = true
    setCampaign(undefined)
    const draftFor = () => drafts ? drafts.get(id).catch(() => null) : Promise.resolve(null)
    const restore = (draft: NonNullable<Awaited<ReturnType<typeof draftFor>>>) => {
      pending.current = draft.campaign
      setCampaign(draft.campaign)
      setSavedInBrowser(true)
    }
    catalog.find(id).then(async (found) => {
      const draft = found ? await draftFor() : null
      if (!alive) return
      if (!draft) { setCampaign(found); return }
      if (draft.base) shared?.rebase?.(id, draft.baseRevision, draft.base)
      restore(draft)
      void flush()
    }, async (error) => {
      const draft = await draftFor()
      if (!alive) return
      if (!draft) { setCampaign(null); return }
      restore(draft)
      setSaveError(error instanceof Error ? error.message : 'Сервер недоступен')
    })
    return () => { alive = false }
  }, [catalog, id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Send what is waiting when the connection returns or the page is left.
  useEffect(() => {
    const now = () => { if (pending.current) void flush() }
    const hidden = () => { if (document.visibilityState === 'hidden') now() }
    window.addEventListener('online', now)
    window.addEventListener('pagehide', now)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('online', now)
      window.removeEventListener('pagehide', now)
      document.removeEventListener('visibilitychange', hidden)
      now()
    }
  }, [flush])

  // Other masters' edits: poll the revision while the tab is visible and nothing is waiting to be written.
  const poll = shared?.poll
  const pollMs = shared?.pollMs ?? SERVER_POLL_MS
  useEffect(() => {
    if (!poll || !shared) return
    let stopped = false
    let asking = false
    const idle = () => !pending.current && !writing.current && timer.current === null
    const tick = async () => {
      if (asking || stopped || document.visibilityState !== 'visible' || !shared.isShared(id) || !idle()) return
      asking = true
      try {
        const fresh = await poll(id)
        if (!fresh || stopped || !idle()) return
        shared.rebase?.(id, fresh.revision, fresh.data)
        setCampaign(fresh.data)
      } catch {
        // A missed poll is not an error the master needs to see; the next one or the next save catches up.
      } finally {
        asking = false
      }
    }
    const every = window.setInterval(() => { void tick() }, pollMs)
    const visible = () => { if (document.visibilityState === 'visible') void tick() }
    document.addEventListener('visibilitychange', visible)
    return () => {
      stopped = true
      window.clearInterval(every)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [poll, pollMs, shared, id])

  const persist = useCallback((next: LocalCampaignRecord) => {
    setCampaign(next)
    rememberCampaign(next)
    pending.current = next
    if (drafts) {
      const base = shared?.baseline?.(next.id) ?? null
      void drafts.set({ campaign: next, baseRevision: base?.revision ?? 0, base: base?.data ?? null, savedAt: new Date().toISOString() }).then(() => setSavedInBrowser(true), () => undefined)
    }
    if (!delay) { void flush(); return }
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { timer.current = null; void flush() }, delay)
  }, [flush, drafts, shared, delay])

  const retry = useCallback(() => { void flush() }, [flush])

  const resolveConflicts = useCallback((mine: string[]) => {
    const chosen = (conflicts?.items ?? []).filter((item) => mine.includes(item.path))
    setConflicts(null)
    if (!chosen.length || !campaign) return
    persist(chosen.reduce((next, item) => applyMine(next as unknown as Record<string, unknown>, item) as unknown as LocalCampaignRecord, campaign))
  }, [conflicts, campaign, persist])

  if (campaign === undefined) return { status: 'loading' }
  if (campaign === null) return { status: 'missing' }
  return { status: 'ready', campaign, persist, saveError, retry, savedInBrowser, conflicts, resolveConflicts }
}
