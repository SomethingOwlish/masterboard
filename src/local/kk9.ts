// КК9 на планировании сессии (этап М4, systemsetup docs/tz/m4-kk9-session-planning-2026-09-27.md):
// живое состояние стола из GET /mb/state и итоги сессии для POST /mb/session.
// Чистые функции — без сети и React.

import type { LocalSessionPlanItem, LocalSessionRecord } from './types'

export interface Kk9Member {
  id: string
  name: string
  physical: { damage: number; max: number }
  mental: { damage: number; max: number }
  energy: { value: number; max: number }
  tension: { current: number; max: number; overcap: number; zone: 'green' | 'yellow' | 'red' | 'exhausted' | string }
  stunned: boolean
  statuses: Array<{ name: string; term: string }>
}

export type Kk9Stream = 'campaign' | 'worldNews' | 'gmPrivate'
export const KK9_STREAMS: Array<[Kk9Stream, string]> = [['campaign', 'Кампания (видят игроки)'], ['gmPrivate', 'Только мастеру'], ['worldNews', 'Новости мира']]
export const KK9_STREAM_LABEL: Record<Kk9Stream, string> = { campaign: 'Кампания', gmPrivate: 'Только мастеру', worldNews: 'Новости мира' }

/** Ответ GET /mb/state. */
export interface Kk9State {
  fetchedAt: string
  campaign: { name: string; gameDate: string; weather: string; worldNote: string; nextSession: string }
  party: Kk9Member[]
  journal: Array<{ id: string; stream: Kk9Stream; title: string; body: string; at: number }>
  requests: Array<{ id: string; kind: string; character: string; name: string; description: string; at: number }>
}

/** Тело POST /mb/session без маршрута (system, externalId, idempotencyKey добавляет дверь). */
export interface Kk9SessionBody {
  journal?: { stream: Kk9Stream; title: string; body: string; expectedFingerprint?: number; force?: boolean }
  nextSession?: string
}

export type Kk9Part = { ok: true; id?: string; stream?: Kk9Stream; fingerprint?: number; value?: string } | { ok: false; status: number; error: string; current?: { title: string; body: string; fingerprint?: number } }
export interface Kk9SessionResult { journal?: Kk9Part; nextSession?: Kk9Part }

export const TENSION_ZONE: Record<string, string> = { green: 'спокойно', yellow: 'нарастает', red: 'на пределе', exhausted: 'истощение' }

/**
 * «Когда следующая игра» строкой, как её пишет сам КК9 в `nextSession`
 * («суббота, 11 октября, 19:00»). Дата — `YYYY-MM-DD`, время — свободный текст.
 */
export function nextSessionText(date: string, time: string): string {
  const parts: string[] = []
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    parts.push(new Date(`${date}T00:00:00Z`).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }))
  }
  if (time.trim()) parts.push(time.trim())
  return parts.join(', ')
}

const sessionTitle = (session: LocalSessionRecord) => `Сессия №${session.number}${session.title.trim() ? ` — ${session.title.trim()}` : ''}`
const logLines = (session: LocalSessionRecord, kinds: string[]) => session.log.filter((entry) => kinds.includes(entry.kind)).map((entry) => `— ${entry.text}`)

/** «Новое в мире» отдельной страницей — для стола, где новости идут своим постом (Ноктюрн, 11-B). */
export function worldNewsPage(session: LocalSessionRecord): { title: string; body: string } | null {
  const world = logLines(session, ['entity'])
  return world.length ? { title: `Новое в мире — ${sessionTitle(session)}`, body: world.join('\n') } : null
}

/**
 * Страница журнала КК9 из разбора: итоги мастера, затем сыгранные сцены,
 * решения, раскрытия и новое в мире из живого журнала. Простой текст: КК9
 * показывает журнал как есть, без разметки. `world: false` — без «Нового в
 * мире»: у Ноктюрна оно уходит своим постом.
 */
export function kk9JournalPage(session: LocalSessionRecord, itemTitle: (item: LocalSessionPlanItem) => string, options: { world?: boolean } = {}): { title: string; body: string } {
  const title = sessionTitle(session)
  const blocks: string[] = []
  if (session.reviewNotes.trim()) blocks.push(session.reviewNotes.trim())
  const played = session.planItems.filter((item) => item.kind === 'scene' && item.status === 'used').map(itemTitle)
  if (played.length) blocks.push(`Сыграно:\n${played.map((name) => `— ${name}`).join('\n')}`)
  const logOf = (kinds: string[]) => logLines(session, kinds)
  const decisions = logOf(['decision'])
  if (decisions.length) blocks.push(`Решения:\n${decisions.join('\n')}`)
  const reveals = logOf(['reveal'])
  if (reveals.length) blocks.push(`Раскрыто:\n${reveals.join('\n')}`)
  const world = options.world === false ? [] : logOf(['entity'])
  if (world.length) blocks.push(`Новое в мире:\n${world.join('\n')}`)
  return { title, body: blocks.join('\n\n') }
}
