import { describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { blankCampaign, createLocalCampaignCatalog } from './catalog'
import { MasterboardApi, createSharedCatalog } from './remote'

/** A Worker stand-in: one document, its revision, and a log of what was asked. */
function fakeWorker(data: Record<string, unknown>) {
  const doc = { path: `localCampaigns/${data.id}`, data, revision: 1 }
  const asked: string[] = []
  const fetcher = (async (url: string) => {
    const path = String(url).replace('/api/', '')
    asked.push(path)
    const body = path.startsWith('revisions/') ? { revision: doc.revision } : doc
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
  return { doc, asked, api: new MasterboardApi(fetcher) }
}

describe('shared catalog polling', () => {
  it('asks only for the revision until it changes, then returns the newer version without taking it as the base', async () => {
    const campaign = { ...blankCampaign('Лунный порт', 'Идея', '2026-09-27T10:00:00.000Z'), id: 'c1' }
    const { doc, asked, api } = fakeWorker(campaign as unknown as Record<string, unknown>)
    const catalog = createSharedCatalog(createLocalCampaignCatalog(new MemoryStorageGateway(), { seed: false }), api, 'owl@example.com')
    await catalog.find('c1')
    asked.length = 0
    expect(await catalog.shared.poll!('c1')).toBeNull()
    expect(asked).toEqual(['revisions/localCampaigns/c1'])

    doc.revision = 2
    doc.data = { ...campaign, notes: ['От Лиса'] }
    const fresh = await catalog.shared.poll!('c1')
    expect(fresh?.revision).toBe(2)
    expect(fresh?.data.notes).toEqual(['От Лиса'])
    expect(catalog.shared.baseline!('c1')?.revision).toBe(1)
    expect(await catalog.shared.poll!('unknown')).toBeNull()
  })
})
