import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../../src/adapters/memoryStorageGateway'
import { createLocalCampaignCatalog } from '../../src/local/catalog'
import { MasterboardApi, SharedConflictError, createSharedCatalog, resolveCatalog } from '../../src/local/remote'
import { newMaster } from '../../src/local/team'
import { handleApi, type Env } from './index'
import { testDb } from './testDb'

const OWNER = 'owl@example.com'
const CO = 'fox@example.com'

let env: Env
beforeEach(() => { env = { DB: testDb() } })

/** The browser client talking to the real Worker handler, signed in as `email`. */
const apiFor = (email: string) => new MasterboardApi((async (input: RequestInfo | URL, init?: RequestInit) => handleApi(new Request(`https://mb.test${String(input)}`, init), { ...env, DEV_USER_EMAIL: email })) as typeof fetch)
const catalogFor = (email: string, browser = createLocalCampaignCatalog(new MemoryStorageGateway(), { seed: false })) => createSharedCatalog(browser, apiFor(email), email)

async function sharedCampaign() {
  const owner = catalogFor(OWNER)
  const campaign = await owner.create('Лунный порт', 'Туман и контрабанда')
  const withCo = await owner.update({ ...campaign, masters: [...campaign.masters, { ...newMaster('Лис'), email: CO }] })
  return { owner, campaign: withCo }
}

describe('shared catalog on the Worker', () => {
  it('creates campaigns on the server with the signed-in master as owner', async () => {
    const { owner, campaign } = await sharedCampaign()
    expect(campaign.masters[0]).toMatchObject({ role: 'owner', email: OWNER })
    expect(owner.shared.isShared(campaign.id)).toBe(true)
    expect((await owner.load()).campaigns.map((item) => item.id)).toEqual([campaign.id])
  })

  it('moves campaigns kept in the browser to the server', async () => {
    const browser = createLocalCampaignCatalog(new MemoryStorageGateway(), { seed: false })
    const old = await browser.create('Старая кампания', 'До входа')
    const owner = catalogFor(OWNER, browser)
    expect((await owner.shared.browserCampaigns()).map((item) => item.id)).toEqual([old.id])
    const moved = await owner.shared.share(old.id)
    expect(moved.masters[0].email).toBe(OWNER)
    expect(await owner.shared.browserCampaigns()).toEqual([])
    expect((await owner.load()).campaigns.map((item) => item.name)).toEqual(['Старая кампания'])
  })

  it('imports an exported file onto the server', async () => {
    const owner = catalogFor(OWNER)
    const created = await owner.create('Лунный порт', '')
    const copy = await owner.importCampaign(await owner.exportCampaign(created.id))
    expect(copy.id).not.toBe(created.id)
    expect((await owner.load()).campaigns.map((item) => item.name).sort()).toEqual(['Лунный порт', 'Лунный порт (копия)'])
  })

  it('shows the campaign to a co-master named by email and hides it from others', async () => {
    const { campaign } = await sharedCampaign()
    const co = catalogFor(CO)
    expect((await co.load()).campaigns.map((item) => item.name)).toContain('Лунный порт')
    expect((await co.find(campaign.id))?.masters.map((master) => master.email)).toEqual([OWNER, CO])
    const stranger = catalogFor('crow@example.com')
    expect((await stranger.load()).campaigns.map((item) => item.id)).not.toContain(campaign.id)
  })

  it('merges edits of two masters made at the same time', async () => {
    const { owner, campaign } = await sharedCampaign()
    const co = catalogFor(CO)
    const seenByCo = (await co.find(campaign.id))!
    await owner.update({ ...campaign, name: 'Порт под луной' })
    const saved = await co.update({ ...seenByCo, activeTime: 'Рассвет' })
    expect(saved).toMatchObject({ name: 'Порт под луной', activeTime: 'Рассвет' })
    expect(await owner.find(campaign.id)).toMatchObject({ name: 'Порт под луной', activeTime: 'Рассвет' })
  })

  it('keeps the other master\'s value on a real clash and reports it', async () => {
    const { owner, campaign } = await sharedCampaign()
    const co = catalogFor(CO)
    const seenByCo = (await co.find(campaign.id))!
    await owner.update({ ...campaign, name: 'Версия совы' })
    const error = await co.update({ ...seenByCo, name: 'Версия лиса', activeTime: 'Рассвет' }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(SharedConflictError)
    expect((error as SharedConflictError).conflicts.map((item) => item.path)).toEqual(['name'])
    expect((error as { saved: { name: string; activeTime: string } }).saved).toMatchObject({ name: 'Версия совы', activeTime: 'Рассвет' })
  })

  it('refuses owner-only changes from a co-master', async () => {
    const { campaign } = await sharedCampaign()
    const co = catalogFor(CO)
    const seen = (await co.find(campaign.id))!
    await expect(co.update({ ...seen, archived: true })).rejects.toThrow()
  })

  it('asks to sign in when there is no signed-in master', async () => {
    const local = createLocalCampaignCatalog(new MemoryStorageGateway())
    const staticHost = new MasterboardApi((async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })) as typeof fetch)
    expect(await resolveCatalog(local, staticHost)).toBeNull()
    expect((await resolveCatalog(local, apiFor(OWNER)))?.shared?.email).toBe(OWNER)
  })
})
