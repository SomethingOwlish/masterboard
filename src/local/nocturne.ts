// Ноктюрн на планировании и разборе сессии (решения 3 октября 2026, лист
// «Мастерборд ↔ Ноктюрн»): живое состояние стола из GET /mb/state и итоги для
// POST /mb/session. Чистые функции и типы — без сети и React.

import { kk9JournalPage, worldNewsPage } from './kk9'
import type { LocalSessionPlanItem, LocalSessionRecord } from './types'

/** Трек одним форматом для V5 и V20 (10-B): значение и максимум, либо максимум и урон по видам. */
export interface NocturneTrack { label: string; max: number; value?: number; damage?: Array<{ label: string; count: number }> }

export interface NocturneMember {
  id: string
  name: string
  subtitle: string
  tracks: NocturneTrack[]
  statuses: Array<{ name: string; term: string }>
  flags: string[]
}

export type NocturneStream = 'campaign' | 'gmPrivate'
export const NOCTURNE_STREAMS: Array<[NocturneStream, string]> = [['campaign', 'Хроника (видят игроки)'], ['gmPrivate', 'Только мастеру']]
export const NOCTURNE_STREAM_LABEL: Record<NocturneStream, string> = { campaign: 'Хроника', gmPrivate: 'Только мастеру' }

export interface NocturneDistrict { id: string; name: string; factionId: string; faction: string; tension: number; tensionLabel: string; description: string; unavailable: boolean }
export const TENSION_LABELS = ['Покой', 'Затишье', 'Напряжение', 'Волнения', 'Хаос', 'Война']

/** Ответ GET /mb/state?system=nocturne. */
export interface NocturneState {
  fetchedAt: string
  campaign: { name: string; system: string; nextSession: { date: string; time: string }; tenets: string[] }
  party: NocturneMember[]
  journal: Array<{ id: string; stream: NocturneStream; kind: string; title: string; body: string; at: number }>
  requests: Array<{ id: string; kind: string; character: string; name: string; description: string; at: number }>
  districts: NocturneDistrict[]
  factions: Array<{ id: string; name: string }>
}

export interface NocturnePostBody { title: string; body: string; expectedFingerprint?: number; force?: boolean }
export interface NocturneDistrictChange { id: string; tension?: number; factionId?: string }

/** Тело POST /mb/session без маршрута (system, externalId, idempotencyKey добавляет дверь). */
export interface NocturneSessionBody {
  journal?: NocturnePostBody & { stream: NocturneStream }
  news?: NocturnePostBody
  nextSession?: { date: string | null; time: string }
  districts?: NocturneDistrictChange[]
}

export type NocturnePart =
  | { ok: true; id?: string; stream?: NocturneStream; fingerprint?: number; ids?: string[]; value?: unknown }
  | { ok: false; status: number; error: string; current?: { title: string; body: string; fingerprint?: number } }
export interface NocturneSessionResult { journal?: NocturnePart; news?: NocturnePart; nextSession?: NocturnePart; districts?: NocturnePart }

/**
 * Посты хроники из разбора (11-B): резюме — итоги, сыгранное, решения и
 * раскрытия; «Новое в мире» — отдельным открытым постом, если оно есть.
 */
export function nocturnePosts(session: LocalSessionRecord, itemTitle: (item: LocalSessionPlanItem) => string): { recap: { title: string; body: string }; news: { title: string; body: string } | null } {
  return { recap: kk9JournalPage(session, itemTitle, { world: false }), news: worldNewsPage(session) }
}

/** Дата следующей игры в Ноктюрн: только `ГГГГ-ММ-ДД`; время — как написано. */
export function nocturneNextSession(nextGame: LocalSessionRecord['nextGame']): NocturneSessionBody['nextSession'] | undefined {
  if (!nextGame || !/^\d{4}-\d{2}-\d{2}$/.test(nextGame.date)) return undefined
  return { date: nextGame.date, time: nextGame.time.trim() }
}

/** «12.10.26, 19:00» — как Ноктюрн показывает дату игры на дашборде. */
export function nocturneDateText(date: string, time: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const day = m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : date
  return [day, time.trim()].filter(Boolean).join(', ')
}
