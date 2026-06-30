// Sessions store (M7 / B5). Independent session documents: a lightweight index
// (sessions/index.json) lists them and holds the next sequence number, while each
// full document — including its planner board canvas and derived scenes — lives
// in sessions/<id>.json. The index is the list page's source; `current` holds the
// one open document for the Session planner.

import { create } from 'zustand'
import { makeSession } from '../model/defaults'
import type { Scene, SessionDoc, SessionMeta } from '../model/types'
import { data } from '../storage/data'
import { useActivity } from './activity'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Human-readable session title per DESIGN: `name · date · #seq`. */
export function sessionTitle(s: Pick<SessionMeta, 'name' | 'realDate' | 'seq'>): string {
  return [s.name || 'Untitled session', s.realDate, `#${s.seq}`].filter(Boolean).join(' · ')
}

function metaOf(doc: SessionDoc): SessionMeta {
  return { id: doc.id, name: doc.name, realDate: doc.realDate, seq: doc.seq }
}

interface SessionsState {
  campaignId: string | null
  sessions: SessionMeta[]
  nextSeq: number
  loading: boolean
  current: SessionDoc | null

  load: (campaignId: string) => Promise<void>
  open: (campaignId: string, sessionId: string) => Promise<void>
  closeCurrent: () => void

  create: () => Promise<SessionDoc | null>
  duplicate: (sessionId: string) => Promise<SessionDoc | null>
  remove: (sessionId: string) => Promise<void>
  /** Update name / realDate, kept in sync across the index and the open document. */
  updateMeta: (sessionId: string, patch: Partial<Pick<SessionMeta, 'name' | 'realDate'>>) => Promise<void>
  /** Persist the open document's canvas snapshot + derived scenes (debounced by caller). */
  saveCurrent: (patch: { canvas?: unknown; scenes?: Scene[] }) => Promise<void>
}

export const useSessions = create<SessionsState>((set, get) => ({
  campaignId: null,
  sessions: [],
  nextSeq: 1,
  loading: false,
  current: null,

  load: async (campaignId) => {
    if (get().campaignId === campaignId && !get().loading) return
    set({ loading: true, campaignId, sessions: [], nextSeq: 1 })
    const index = await data.readSessionsIndex(campaignId)
    if (get().campaignId === campaignId) set({ sessions: index.sessions, nextSeq: index.nextSeq, loading: false })
  },

  open: async (campaignId, sessionId) => {
    if (get().campaignId !== campaignId) await get().load(campaignId)
    set({ current: null })
    const doc = await data.readSession(campaignId, sessionId)
    if (get().campaignId === campaignId) set({ current: doc })
  },

  closeCurrent: () => set({ current: null }),

  create: async () => {
    const { campaignId, sessions, nextSeq } = get()
    if (!campaignId) return null
    const doc = makeSession('', todayISO(), nextSeq)
    await data.writeSession(campaignId, doc)
    const index = { sessions: [...sessions, metaOf(doc)], nextSeq: nextSeq + 1 }
    set(index)
    await data.writeSessionsIndex(campaignId, index)
    void useActivity.getState().log(campaignId, 'Created session', `#${doc.seq}`)
    return doc
  },

  duplicate: async (sessionId) => {
    const { campaignId, sessions, nextSeq } = get()
    if (!campaignId) return null
    const source = await data.readSession(campaignId, sessionId)
    if (!source) return null
    const copy = makeSession(source.name ? `${source.name} (copy)` : '', source.realDate, nextSeq)
    copy.canvas = source.canvas
    copy.scenes = source.scenes
    await data.writeSession(campaignId, copy)
    const index = { sessions: [...sessions, metaOf(copy)], nextSeq: nextSeq + 1 }
    set(index)
    await data.writeSessionsIndex(campaignId, index)
    void useActivity.getState().log(campaignId, 'Duplicated session', `#${copy.seq}`)
    return copy
  },

  remove: async (sessionId) => {
    const { campaignId, sessions, nextSeq, current } = get()
    if (!campaignId) return
    const target = sessions.find((s) => s.id === sessionId)
    const nextSessions = sessions.filter((s) => s.id !== sessionId)
    set({ sessions: nextSessions, current: current?.id === sessionId ? null : current })
    await data.removeSession(campaignId, sessionId)
    await data.writeSessionsIndex(campaignId, { sessions: nextSessions, nextSeq })
    if (target) void useActivity.getState().log(campaignId, 'Deleted session', `#${target.seq}`)
  },

  updateMeta: async (sessionId, patch) => {
    const { campaignId, sessions, nextSeq, current } = get()
    if (!campaignId) return
    const nextSessions = sessions.map((s) => (s.id === sessionId ? { ...s, ...patch } : s))
    const nextCurrent = current && current.id === sessionId ? { ...current, ...patch } : current
    set({ sessions: nextSessions, current: nextCurrent })
    await data.writeSessionsIndex(campaignId, { sessions: nextSessions, nextSeq })
    if (nextCurrent && nextCurrent.id === sessionId) await data.writeSession(campaignId, nextCurrent)
  },

  saveCurrent: async (patch) => {
    const { campaignId, current } = get()
    if (!campaignId || !current) return
    const next = { ...current, ...patch }
    set({ current: next })
    await data.writeSession(campaignId, next)
  },
}))
