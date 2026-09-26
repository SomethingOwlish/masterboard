import { describe, expect, it } from 'vitest'
import type { PublicationQueueItem } from '../model/external'
import { ExternalError, HttpExternalGateway } from './external'

function gateway(respond: (url: string, init?: RequestInit) => Response) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => { calls.push({ url: String(input), init }); return respond(String(input), init) }) as typeof fetch
  return { port: new HttpExternalGateway(fetcher), calls }
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const item: PublicationQueueItem = { id: 'pub-1', entityId: 'e', entityType: 'npc', connectionId: 'lorebook:w1', operation: 'update', patch: { name: 'Олан' }, state: 'ready', createdAt: '', targetType: 'character', target: { entityId: 'x1', expectedUpdatedAt: 7 } }

describe('HTTP door to lorebridge', () => {
  it('names connections by system and world, and asks passports and records for them', async () => {
    const { port, calls } = gateway((url) => url.endsWith('connections') ? json({ connections: [{ system: 'lorebook', scope: 'world', externalId: 'w/1', label: 'Порт' }] }) : url.includes('passport') ? json({ fetchedAt: 'x', entities: [] }) : json({ items: [], ids: [] }))
    const [connection] = await port.listConnections()
    expect(connection).toMatchObject({ id: 'lorebook:w/1', label: 'Порт', state: 'active' })
    expect(await port.getPassport(connection.id)).toEqual({ fetchedAt: 'x', entities: [], connectionId: 'lorebook:w/1' })
    await port.entities(connection.id, 'character')
    expect(calls.map((call) => call.url)).toEqual(['/api/ext/connections', '/api/ext/passport?system=lorebook&externalId=w%2F1', '/api/ext/entities?system=lorebook&externalId=w%2F1&type=character'])
  })

  it('publishes by the contract and keeps the answer', async () => {
    const { port, calls } = gateway(() => json({ id: 'x1', updatedAt: 9, url: 'https://lb/x1' }))
    expect(await port.publish(item)).toMatchObject({ state: 'succeeded', result: { id: 'x1', updatedAt: 9, url: 'https://lb/x1' } })
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ system: 'lorebook', externalId: 'w1', operation: 'update', entityType: 'character', entityId: 'x1', expectedUpdatedAt: 7, idempotencyKey: 'pub-1', patch: { name: 'Олан' } })
  })

  it('explains a stale write, a refusal by side and a door that is not configured', async () => {
    const stale = await gateway(() => json({ error: 'stale', current: { id: 'x1' } }, 409)).port.publish(item).catch((error: ExternalError) => error)
    expect(stale).toMatchObject({ status: 409, kind: 'conflict', current: { id: 'x1' } })
    expect((stale as Error).message).toContain('Обновите сущность из источника')
    await expect(gateway(() => json({ error: 'Нет доступа к миру', side: 'lorebook', kind: 'denied' }, 403)).port.listConnections()).rejects.toThrow('Лорбук: Нет доступа к миру')
    const unconfigured = await gateway(() => json({ error: 'не настроена', kind: 'unconfigured' }, 501)).port.listConnections().catch((error: ExternalError) => error)
    expect((unconfigured as ExternalError).unconfigured).toBe(true)
  })
})
