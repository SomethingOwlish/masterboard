// Player profiles shared by every master (ТЗ-2, R11). The server keeps them
// in its own table; each master's note travels only to that master.

import type { LocalCampaignRecord } from './types'

export const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const
export type Weekday = typeof WEEKDAYS[number]

export interface PlayerProfile {
  id: string
  name: string
  contacts: string
  /** What they enjoy at the table. */
  preferences: string
  /** Lines and veils, topics to avoid. */
  limits: string
  availability: { days: Weekday[]; note: string }
  /** Notes every master sees. */
  notes: string
}
export interface PlayerEntry { profile: PlayerProfile; revision: number; updatedBy?: string; myNote: string }

export const newProfile = (name: string): PlayerProfile => ({ id: `player-${crypto.randomUUID()}`, name: name.trim(), contacts: '', preferences: '', limits: '', availability: { days: [], note: '' }, notes: '' })

export function toProfile(id: string, data: Record<string, unknown>): PlayerProfile {
  const text = (value: unknown) => typeof value === 'string' ? value : ''
  const availability = (data.availability ?? {}) as { days?: unknown; note?: unknown }
  return { id, name: text(data.name), contacts: text(data.contacts), preferences: text(data.preferences), limits: text(data.limits), notes: text(data.notes), availability: { days: Array.isArray(availability.days) ? availability.days.filter((day): day is Weekday => (WEEKDAYS as readonly string[]).includes(day)) : [], note: text(availability.note) } }
}

export class PlayersConflictError extends Error { constructor(readonly current: PlayerEntry | null) { super('Профиль уже изменил другой мастер — на экране его версия'); this.name = 'PlayersConflictError' } }

export interface PlayersGateway {
  list(): Promise<PlayerEntry[]>
  save(profile: PlayerProfile, expectedRevision: number): Promise<PlayerEntry>
  note(id: string, text: string): Promise<PlayerEntry>
  remove(id: string): Promise<void>
}

type Wire = { id: string; data: Record<string, unknown>; revision: number; updatedBy?: string; myNote?: string }
const fromWire = (item: Wire): PlayerEntry => ({ profile: toProfile(item.id, item.data), revision: item.revision, updatedBy: item.updatedBy, myNote: item.myNote ?? '' })

/** The Worker's /api/players. */
export class HttpPlayersGateway implements PlayersGateway {
  constructor(private readonly fetcher: typeof fetch = (...args) => fetch(...args), private readonly base = '/api/players') {}
  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetcher(`${this.base}${path}`, { credentials: 'same-origin', ...init, headers: init?.body ? { 'content-type': 'application/json' } : undefined })
    const body = response.status === 204 ? null : await response.json().catch(() => null) as { error?: string; current?: { data: Record<string, unknown>; revision: number; updatedBy?: string } } | null
    if (response.status === 409) throw new PlayersConflictError(body?.current ? fromWire({ id: String(body.current.data.id ?? ''), ...body.current }) : null)
    if (!response.ok) throw new Error(body?.error ?? `Ошибка сервера ${response.status}`)
    return body as T
  }
  async list() { return (await this.call<Wire[]>('')).map(fromWire) }
  async save(profile: PlayerProfile, expectedRevision: number) { const { id, ...data } = profile; return fromWire(await this.call<Wire>(`/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ data, expectedRevision }) })) }
  async note(id: string, text: string) { return fromWire(await this.call<Wire>(`/${encodeURIComponent(id)}/note`, { method: 'PUT', body: JSON.stringify({ text }) })) }
  async remove(id: string) { await this.call<null>(`/${encodeURIComponent(id)}`, { method: 'DELETE' }) }
}

/** In memory, for tests and screens without a server. */
export class MemoryPlayersGateway implements PlayersGateway {
  readonly entries = new Map<string, PlayerEntry>()
  async list() { return [...this.entries.values()].map((entry) => structuredClone(entry)) }
  async save(profile: PlayerProfile, expectedRevision: number) {
    const current = this.entries.get(profile.id)
    if ((current?.revision ?? 0) !== expectedRevision) throw new PlayersConflictError(current ?? null)
    const entry = { profile: structuredClone(profile), revision: expectedRevision + 1, myNote: current?.myNote ?? '' }
    this.entries.set(profile.id, entry)
    return structuredClone(entry)
  }
  async note(id: string, text: string) { const entry = this.entries.get(id); if (!entry) throw new Error('Нет такого игрока'); entry.myNote = text; return structuredClone(entry) }
  async remove(id: string) { this.entries.delete(id) }
}

/** Characters of a profile across the campaigns this master can open. */
export function charactersByCampaign(campaigns: LocalCampaignRecord[], profileId: string): Array<{ campaignId: string; campaign: string; characters: string[] }> {
  return campaigns.flatMap((campaign) => campaign.players.filter((player) => player.profileId === profileId).map((player) => ({
    campaignId: campaign.id, campaign: campaign.name,
    characters: campaign.entities.filter((entity) => player.characterIds.includes(entity.id)).map((entity) => entity.name),
  })))
}
