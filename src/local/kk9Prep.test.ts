// Находки аудита М0 (systemsetup/docs/tz/m0-kk9-masterboard-audit-2026-09-27.md),
// починенные до подключения КК9 — каждая своим случаем.
import { describe, expect, it } from 'vitest'
import type { ExternalGateway } from '../adapters/fakeExternal'
import { executeBatch } from '../lib/publicationQueue'
import type { PublicationQueueItem } from '../model/external'
import { ExternalError, HttpExternalGateway } from './external'
import { normalizeCampaign } from './normalize'

const NOW = '2026-09-27T00:00:00.000Z'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const door = (respond: () => Response) => new HttpExternalGateway((async () => respond()) as typeof fetch)
const source = (system: string) => ({ system, containerId: 'c1', id: 'x1', type: 'npc', updatedAt: 1, syncedAt: NOW, snapshot: { name: 'Олан' } })

describe('П1: незнакомая система не перекрашивается в Лорбук', () => {
  const campaign = normalizeCampaign({
    id: 'c', name: 'К',
    entities: [{ id: 'e1', type: 'npc', name: 'Олан', sources: [source('lovegame'), source('ragnar')] }],
    integrations: { lovegame: { externalId: 'g1', label: 'Игра' }, ragnar: { externalId: 'r1', label: 'Рагнар' } },
  }, NOW)!

  it('источник знакомой системы остаётся, незнакомой — уходит, а не становится lorebook', () => {
    expect(campaign.entities[0].sources.map((item) => item.system)).toEqual(['lovegame'])
  })
  it('связь незнакомой системы не превращается в связь с Лорбуком', () => {
    expect(Object.keys(campaign.integrations)).toEqual(['lovegame'])
  })
})

describe('П2: ошибка называет систему', () => {
  it('русское имя берега из моста печатается префиксом', async () => {
    const error = await door(() => json({ error: 'база не ответила', side: 'Лорбук' }, 502)).listConnections().then(() => null, (failure: unknown) => failure as ExternalError)
    expect(error!.message).toBe('Лорбук: база не ответила')
  })
  it('ключ системы переводится в подпись', async () => {
    const error = await door(() => json({ error: 'нет', side: 'lovegame' }, 403)).listConnections().then(() => null, (failure: unknown) => failure as ExternalError)
    expect(error!.message).toBe('ЛавГеймс: нет')
  })
})

describe('П4: живые id видны рядом с читаемыми записями', () => {
  it('ids моста доезжают, их нет — берутся id записей', async () => {
    expect(await door(() => json({ items: [], ids: ['gone-not', 'hidden'] })).listing('lovegame:g1')).toEqual({ items: [], ids: ['gone-not', 'hidden'] })
    expect((await door(() => json({ items: [{ id: 'a' }] })).listing('lovegame:g1')).ids).toEqual(['a'])
  })
})

describe('П5: пачка уходит по одной', () => {
  it('следующая отправка не начинается, пока не кончилась предыдущая', async () => {
    let inFlight = 0, peak = 0
    const gateway = { publish: async (item: PublicationQueueItem) => { inFlight++; peak = Math.max(peak, inFlight); await new Promise((done) => setTimeout(done, 5)); inFlight--; return { ...item, state: 'succeeded' as const } } } as unknown as ExternalGateway
    const ready = (id: string): PublicationQueueItem => ({ id, entityId: id, entityType: 'npc', connectionId: 'lovegame:g1', operation: 'create', patch: {}, state: 'ready', createdAt: NOW, confirmedAt: NOW })
    const result = await executeBatch([ready('a'), ready('b'), ready('c')], gateway, NOW)
    expect(result.succeeded).toBe(3)
    expect(peak).toBe(1)
  })
})

describe('КК9 — знакомая система', () => {
  it('источник и связь КК9 переживают загрузку кампании', () => {
    const campaign = normalizeCampaign({ id: 'c', name: 'К', entities: [{ id: 'e1', type: 'npc', name: 'Декан', sources: [source('kk9')] }], integrations: { kk9: { externalId: 'k1', label: 'Академия' } } }, NOW)!
    expect(campaign.entities[0].sources[0].system).toBe('kk9')
    expect(campaign.integrations.kk9).toEqual({ externalId: 'k1', label: 'Академия', url: undefined })
  })
})
