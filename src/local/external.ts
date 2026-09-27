import type { ExternalGateway } from '../adapters/fakeExternal'
import { isExternalSystem, type CapabilityPassport, type ExternalConnection, type ExternalSystem, type PublicationQueueItem } from '../model/external'
import { SYSTEM_LABEL, connectionKey, parseConnectionKey, type ExternalItem, type ExternalListing } from './integration'

/** A refusal from the Worker or lorebridge, with the bridge's `side` / `kind` when it gave them. */
export class ExternalError extends Error {
  constructor(message: string, readonly status: number, readonly kind?: string, readonly current?: ExternalItem) { super(message); this.name = 'ExternalError' }
  /** 501: the Worker has no service binding or secret yet. */
  get unconfigured() { return this.kind === 'unconfigured' }
}

/** Reads and publishes through the Worker's /api/ext/* door to lorebridge. */
export class HttpExternalGateway implements ExternalGateway {
  constructor(private readonly fetcher: typeof fetch = (...args) => fetch(...args), private readonly base = '/api/ext') {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response
    try { response = await this.fetcher(`${this.base}/${path}`, { credentials: 'same-origin', ...init }) } catch { throw new ExternalError('Нет связи с сервером Мастерборда', 0) }
    const text = await response.text()
    let body: Record<string, unknown> = {}
    try { body = text ? JSON.parse(text) : {} } catch { throw new ExternalError(`Сервер ответил не JSON (${response.status})`, response.status) }
    if (!response.ok) {
      // lorebridge names the side in Russian («Лорбук»); a system key is accepted too.
      const side = typeof body.side !== 'string' || !body.side ? '' : `${isExternalSystem(body.side) ? SYSTEM_LABEL[body.side] : body.side}: `
      throw new ExternalError(`${side}${typeof body.error === 'string' ? body.error : `ошибка ${response.status}`}`, response.status, typeof body.kind === 'string' ? body.kind : undefined, body.current as ExternalItem | undefined)
    }
    return body as T
  }

  async listConnections(): Promise<ExternalConnection[]> {
    const { connections } = await this.call<{ connections: Array<{ system: ExternalSystem; scope: ExternalConnection['scope']; externalId: string; label: string; url?: string }> }>('connections')
    return connections.map((item) => ({ id: connectionKey(item.system, item.externalId), system: item.system, scope: item.scope, externalId: item.externalId, label: item.label, url: item.url, state: 'active' }))
  }

  async getPassport(connectionId: string): Promise<CapabilityPassport> {
    const { system, externalId } = parseConnectionKey(connectionId)
    const passport = await this.call<Omit<CapabilityPassport, 'connectionId'>>(`passport?system=${system}&externalId=${encodeURIComponent(externalId)}`)
    return { ...passport, connectionId }
  }

  async entities(connectionId: string, type?: string): Promise<ExternalItem[]> {
    return (await this.listing(connectionId, type)).items
  }

  /** `ids` are all live records of the type, readable or not — how a hard delete becomes visible. */
  async listing(connectionId: string, type?: string): Promise<ExternalListing> {
    const { system, externalId } = parseConnectionKey(connectionId)
    const { items, ids } = await this.call<{ items: ExternalItem[]; ids?: string[] }>(`entities?system=${system}&externalId=${encodeURIComponent(externalId)}${type ? `&type=${encodeURIComponent(type)}` : ''}`)
    return { items, ids: ids ?? items.map((item) => item.id) }
  }

  async publish(item: PublicationQueueItem): Promise<PublicationQueueItem> {
    const { system, externalId } = parseConnectionKey(item.connectionId)
    try {
      const result = await this.call<{ id: string; updatedAt: number; url?: string }>('publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ system, externalId, operation: item.operation, entityType: item.targetType ?? item.entityType, entityId: item.target?.entityId, expectedUpdatedAt: item.target?.expectedUpdatedAt, idempotencyKey: item.id, patch: item.patch }),
      })
      return { ...item, state: 'succeeded', result }
    } catch (error) {
      if (error instanceof ExternalError && error.status === 409) throw new ExternalError(`${SYSTEM_LABEL[system]}: запись изменили там после последнего чтения. Обновите сущность из источника и отправьте снова.`, 409, 'conflict', error.current)
      throw error
    }
  }
}
