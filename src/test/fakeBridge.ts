import type { CapabilityPassport, ExternalConnection, PublicationQueueItem } from '../model/external'
import { ExternalError } from '../local/external'
import { connectionKey, parseConnectionKey, type ExternalItem, type ExternalPatch } from '../local/integration'
import type { ExternalPort } from '../local/useExternal'
import type { Kk9SessionBody, Kk9SessionResult, Kk9State, Kk9Stream } from '../local/kk9'

const passport = (entities: CapabilityPassport['entities']): Omit<CapabilityPassport, 'connectionId'> => ({ fetchedAt: '2026-09-26T00:00:00.000Z', entities })

export const LOREBOOK = connectionKey('lorebook', 'w-port')
export const LOVEGAME = connectionKey('lovegame', 'c-lanterns')
export const SYSTEMSETUP = connectionKey('systemsetup', 'packs')

/**
 * lorebridge in memory, speaking the /mb contract: records per connection,
 * a clock for updatedAt, 409 on a stale expectedUpdatedAt, and outages on demand.
 */
export class FakeBridge implements ExternalPort {
  readonly records = new Map<string, ExternalItem[]>()
  readonly sent: PublicationQueueItem[] = []
  readonly failing = new Set<string>()
  private clock = 1000
  constructor(readonly connections: ExternalConnection[] = [
    { id: LOREBOOK, system: 'lorebook', scope: 'world', externalId: 'w-port', label: 'Лунный порт', url: 'https://lorebook.test/w/w-port', state: 'active' },
    { id: LOVEGAME, system: 'lovegame', scope: 'campaign', externalId: 'c-lanterns', label: 'Фонари', state: 'active' },
    { id: SYSTEMSETUP, system: 'systemsetup', scope: 'system', externalId: 'packs', label: 'Игровые системы', state: 'active' },
  ]) {}

  passports: Record<string, Omit<CapabilityPassport, 'connectionId'>> = {
    [LOREBOOK]: passport([
      { entityType: 'character', label: 'Персонаж', enabled: true, operations: ['read', 'create', 'update', 'archive', 'change-visibility', 'change-status'] },
      { entityType: 'location', label: 'Локация', enabled: true, operations: ['read', 'create', 'update', 'archive', 'change-visibility', 'change-status'] },
      { entityType: 'faction', label: 'Фракция', enabled: true, operations: ['read', 'create', 'update', 'archive', 'change-visibility', 'change-status'] },
      { entityType: 'lore', label: 'Лор', enabled: true, operations: ['read', 'create', 'update', 'archive', 'change-visibility', 'change-status'] },
    ]),
    [LOVEGAME]: passport([
      { entityType: 'npc', label: 'НПС', enabled: true, operations: ['read', 'create', 'update', 'change-visibility'] },
      { entityType: 'handout', label: 'Раздатка', enabled: true, operations: ['read', 'create', 'update', 'change-visibility'] },
      { entityType: 'codex', label: 'Кодекс', enabled: true, operations: ['read', 'create', 'update', 'change-visibility'], unavailableReason: 'Архива нет' },
    ]),
    [SYSTEMSETUP]: passport([{ entityType: 'system', label: 'Система', enabled: true, operations: ['read'] }]),
  }

  seed(connectionId: string, item: Partial<ExternalItem> & Pick<ExternalItem, 'id' | 'type' | 'name'>) {
    const full: ExternalItem = { summary: '', tags: [], fields: {}, visibility: 'public', status: 'canon', archived: false, updatedAt: this.tick(), ...item }
    this.records.set(connectionId, [...(this.records.get(connectionId) ?? []).filter((record) => record.id !== item.id), full])
    return full
  }

  /** Someone edits the record in lorebook / lovegame directly. */
  editThere(connectionId: string, id: string, patch: Partial<ExternalItem>) {
    const current = this.records.get(connectionId)!.find((record) => record.id === id)!
    return this.seed(connectionId, { ...current, ...patch, updatedAt: this.tick() })
  }

  private tick() { this.clock += 1; return this.clock }

  async listConnections() { return this.connections }
  async getPassport(connectionId: string): Promise<CapabilityPassport> {
    const found = this.passports[connectionId]
    if (!found) throw new ExternalError('Нет такого подключения', 404)
    return { ...found, connectionId }
  }
  async entities(connectionId: string, type?: string) { return (this.records.get(connectionId) ?? []).filter((item) => !type || item.type === type) }
  /** `hidden` are live records the master may not read: they are in `ids`, not in `items`. */
  readonly hidden = new Map<string, string[]>()
  async listing(connectionId: string, type?: string) {
    const items = await this.entities(connectionId, type)
    return { items, ids: [...items.map((item) => item.id), ...(this.hidden.get(connectionId) ?? [])] }
  }

  /** КК9 (М4): состояние стола по id кампании и страницы журнала по ключу повтора. */
  readonly kk9 = new Map<string, Kk9State>()
  readonly kk9Pages = new Map<string, { stream: Kk9Stream; title: string; body: string }>()
  readonly kk9Sessions: Array<{ externalId: string; sessionId: string; body: Kk9SessionBody }> = []
  async kk9State(externalId: string): Promise<Kk9State> {
    const found = this.kk9.get(externalId)
    if (!found) throw new ExternalError('КК9: такой кампании нет', 404)
    return found
  }
  async sendKk9Session(externalId: string, sessionId: string, body: Kk9SessionBody): Promise<Kk9SessionResult> {
    this.kk9Sessions.push({ externalId, sessionId, body })
    const out: Kk9SessionResult = {}
    if (body.journal) {
      const print = (page: { title: string; body: string }) => page.title.length * 31 + page.body.length
      const was = this.kk9Pages.get(sessionId)
      if (was && !body.journal.force && body.journal.expectedFingerprint !== undefined && print(was) !== body.journal.expectedFingerprint) {
        out.journal = { ok: false, status: 409, error: 'Страницу поправили в КК9 после прошлой отправки', current: { title: was.title, body: was.body } }
      } else {
        const page = { stream: body.journal.stream, title: body.journal.title, body: body.journal.body }
        this.kk9Pages.set(sessionId, page)
        out.journal = { ok: true, id: `page-${sessionId}`, stream: page.stream, fingerprint: print(page) }
      }
    }
    if (body.nextSession !== undefined) {
      const state = this.kk9.get(externalId)
      if (state) state.campaign.nextSession = body.nextSession
      out.nextSession = { ok: true, value: body.nextSession }
    }
    return out
  }

  async publish(item: PublicationQueueItem): Promise<PublicationQueueItem> {
    this.sent.push(item)
    if (this.failing.has(item.connectionId)) throw new ExternalError('Лорбук: база не ответила', 502)
    const { system } = parseConnectionKey(item.connectionId)
    if (system === 'systemsetup') throw new ExternalError('SystemSetup только для чтения', 405)
    const patch = item.patch as ExternalPatch
    const list = this.records.get(item.connectionId) ?? []
    if (item.operation === 'create') {
      const created = this.seed(item.connectionId, { id: `ext-${list.length + 1}`, type: item.targetType ?? item.entityType, name: patch.name ?? '', summary: patch.summary ?? '', tags: patch.tags ?? [], fields: patch.fields ?? {}, visibility: patch.visibility ?? 'master', url: `https://${system}.test/${item.connectionId}/${list.length + 1}` })
      return { ...item, state: 'succeeded', result: { id: created.id, updatedAt: created.updatedAt, url: created.url } }
    }
    const current = list.find((record) => record.id === item.target?.entityId)
    if (!current) throw new ExternalError('Записи больше нет', 404)
    if (item.target?.expectedUpdatedAt !== undefined && item.target.expectedUpdatedAt !== current.updatedAt) throw new ExternalError('Запись изменили', 409, 'conflict', current)
    const next = this.seed(item.connectionId, { ...current, ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.summary !== undefined ? { summary: patch.summary } : {}), ...(patch.tags ? { tags: patch.tags } : {}), ...(patch.fields ? { fields: patch.fields } : {}), ...(patch.visibility ? { visibility: patch.visibility } : {}), ...(item.operation === 'archive' ? { archived: true, status: 'archived' } : {}), updatedAt: this.tick() })
    return { ...item, state: 'succeeded', result: { id: next.id, updatedAt: next.updatedAt, url: next.url } }
  }
}
