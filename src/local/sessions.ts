// Session lifecycle rules for the local campaign: real dates, duplicates, trash and the single running game.

import type { LocalCampaignRecord, LocalSessionFlow, LocalSessionRecord } from './types'

/** `''` (no date) or a real calendar day as `YYYY-MM-DD`; rejects days like 2026-02-30. */
export function validSessionDate(value: string): boolean {
  if (value === '') return true
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export const liveSessions = (campaign: LocalCampaignRecord): LocalSessionRecord[] => campaign.sessionRecords.filter((session) => !session.deletedAt)
export const trashedSessions = (campaign: LocalCampaignRecord): LocalSessionRecord[] => campaign.sessionRecords.filter((session) => Boolean(session.deletedAt))

/** Trashed sessions keep their numbers, so a number is never handed out twice. */
export const nextSessionNumber = (campaign: LocalCampaignRecord): number => Math.max(0, ...campaign.sessionRecords.map((session) => session.number)) + 1

/** The live session currently being played, if any. */
export const runningSession = (campaign: LocalCampaignRecord): LocalSessionRecord | undefined => liveSessions(campaign).find((session) => session.status === 'active')

function find(campaign: LocalCampaignRecord, id: string): LocalSessionRecord {
  const session = campaign.sessionRecords.find((item) => item.id === id)
  if (!session) throw new Error('Сессия не найдена')
  return session
}

const replace = (campaign: LocalCampaignRecord, next: LocalSessionRecord, activeSessionId: string | undefined): LocalCampaignRecord =>
  ({ ...campaign, sessionRecords: campaign.sessionRecords.map((item) => item.id === next.id ? next : item), activeSessionId })

/**
 * Copies a session's plan into a new draft: fresh plan item ids with scenes, arrows
 * and graph positions remapped; play history (log, review, date, statuses, next game,
 * КК9 send) cleared.
 */
export function duplicateSession(campaign: LocalCampaignRecord, id: string, now: string): LocalCampaignRecord {
  const source = find(campaign, id)
  const ids = new Map(source.planItems.map((item) => [item.id, `plan-${crypto.randomUUID()}`]))
  const remap = (itemId: string) => ids.get(itemId) ?? itemId
  const planItems = source.planItems.map(({ carriedFromSessionId: _carried, carriedFromItemId: _carriedItem, ...item }) => ({ ...item, id: remap(item.id), sceneId: item.sceneId && remap(item.sceneId), status: 'prepared' as const }))
  const flows = source.flows.map((flow): LocalSessionFlow => ({ ...flow, id: `flow-${crypto.randomUUID()}`, fromItemId: remap(flow.fromItemId), toItemId: remap(flow.toItemId) }))
  const planLayout = Object.fromEntries(Object.entries(source.planLayout).map(([itemId, position]) => [remap(itemId), { ...position }]))
  const copy: LocalSessionRecord = {
    ...structuredClone(source),
    id: `session-${crypto.randomUUID()}`,
    number: nextSessionNumber(campaign),
    title: `${source.title} (копия)`,
    status: 'draft',
    date: '',
    deletedAt: undefined,
    handovers: [],
    planItems,
    flows,
    planLayout,
    log: [],
    reviewNotes: '',
    reviewStatus: 'draft',
    reviewDecisions: {},
    appliedDecisions: {},
    nextSessionId: undefined,
    nextGame: undefined,
    kk9Sent: undefined,
    createdAt: now,
  }
  return { ...campaign, sessionRecords: [...campaign.sessionRecords, copy], activeSessionId: copy.id }
}

/** Moves a session to the trash; a game in progress has to be finished first. */
export function trashSession(campaign: LocalCampaignRecord, id: string, now: string): LocalCampaignRecord {
  const session = find(campaign, id)
  if (session.status === 'active') throw new Error('Сессия ещё идёт — сначала завершите её')
  const next = { ...session, deletedAt: now }
  const activeSessionId = campaign.activeSessionId === id ? liveSessions(campaign).filter((item) => item.id !== id).at(-1)?.id : campaign.activeSessionId
  return replace(campaign, next, activeSessionId)
}

export function restoreSession(campaign: LocalCampaignRecord, id: string): LocalCampaignRecord {
  const { deletedAt: _deletedAt, ...session } = find(campaign, id)
  return replace(campaign, session, id)
}

/**
 * Deletes trashed sessions for good. Secrets stop listing them; other records
 * that mention a session (origins, history) keep the id as a plain reference.
 */
export function purgeSessions(campaign: LocalCampaignRecord, ids: string[]): LocalCampaignRecord {
  const gone = new Set(ids.filter((id) => find(campaign, id).deletedAt))
  if (!gone.size) return campaign
  const sessionRecords = campaign.sessionRecords.filter((session) => !gone.has(session.id))
  return {
    ...campaign,
    sessionRecords,
    secrets: campaign.secrets.map((secret) => secret.sessionIds.some((id) => gone.has(id)) ? { ...secret, sessionIds: secret.sessionIds.filter((id) => !gone.has(id)) } : secret),
    activeSessionId: campaign.activeSessionId && gone.has(campaign.activeSessionId) ? liveSessions({ ...campaign, sessionRecords }).at(-1)?.id : campaign.activeSessionId,
  }
}

/** Starts a game. Preparing other sessions stays possible, but only one can be played at a time. */
export function startSession(campaign: LocalCampaignRecord, id: string): LocalCampaignRecord {
  const session = find(campaign, id)
  if (session.deletedAt) throw new Error('Сессия в корзине — сначала восстановите её')
  const running = runningSession(campaign)
  if (running && running.id !== id) throw new Error(`Сессия №${running.number} уже идёт — завершите её, прежде чем начинать новую`)
  return replace(campaign, { ...session, status: 'active' }, id)
}
