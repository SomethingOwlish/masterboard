import { beforeEach, describe, expect, it } from 'vitest'
import { resetKeyCache, verifyAccessJwt } from './auth'
import { handleApi, type Env } from './index'
import { testDb } from './testDb'

const OWNER = 'owl@example.com'
const CO = 'fox@example.com'
const STRANGER = 'crow@example.com'

const campaign = (patch: Record<string, unknown> = {}) => ({
  id: 'c1', name: 'Лунный порт',
  masters: [{ id: 'm-owl', name: 'Сова', email: OWNER, role: 'owner' }, { id: 'm-fox', name: 'Лис', email: CO, role: 'co-master' }],
  archived: false,
  sessionRecords: [{ id: 's1', masterId: 'm-owl', status: 'draft', reviewStatus: 'draft' }, { id: 's2', masterId: 'm-fox', status: 'draft', reviewStatus: 'draft' }],
  ...patch,
})

let env: Env
beforeEach(() => { env = { DB: testDb() } })

async function call(email: string, method: string, path: string, body?: unknown) {
  const response = await handleApi(new Request(`https://mb.test/api/${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }), { ...env, DEV_USER_EMAIL: email })
  return { status: response.status, body: response.status === 204 ? null : await response.json() as Record<string, unknown> }
}

describe('worker API', () => {
  it('creates a shared campaign for its owner and lists it for every master', async () => {
    expect((await call(OWNER, 'GET', 'me')).body).toEqual({ email: OWNER })
    const created = await call(OWNER, 'PUT', 'docs/localCampaigns/c1', { data: campaign(), expectedRevision: 0 })
    expect(created).toMatchObject({ status: 200, body: { path: 'localCampaigns/c1', revision: 1 } })
    expect(((await call(CO, 'GET', 'collections/localCampaigns')).body as unknown as unknown[]).length).toBe(1)
    expect((await call(STRANGER, 'GET', 'collections/localCampaigns')).body).toEqual([])
    expect((await call(STRANGER, 'GET', 'docs/localCampaigns/c1')).status).toBe(404)
  })

  it('refuses to create a campaign whose owner is someone else', async () => {
    expect((await call(CO, 'PUT', 'docs/localCampaigns/c1', { data: campaign() })).status).toBe(403)
  })

  it('detects stale writes with the revision and returns the current document', async () => {
    await call(OWNER, 'PUT', 'docs/localCampaigns/c1', { data: campaign() })
    await call(CO, 'PUT', 'docs/localCampaigns/c1', { data: campaign({ name: 'Новое имя' }), expectedRevision: 1 })
    const stale = await call(OWNER, 'PUT', 'docs/localCampaigns/c1', { data: campaign({ name: 'Моё имя' }), expectedRevision: 1 })
    expect(stale).toMatchObject({ status: 409, body: { expected: 1, actual: 2, current: { revision: 2, data: { name: 'Новое имя' } } } })
  })

  it('enforces owner-only and responsible-master rules on the server', async () => {
    await call(OWNER, 'PUT', 'docs/localCampaigns/c1', { data: campaign() })
    const base = campaign()
    expect((await call(CO, 'PUT', 'docs/localCampaigns/c1', { data: { ...base, archived: true } })).status).toBe(403)
    expect((await call(CO, 'PUT', 'docs/localCampaigns/c1', { data: { ...base, masters: [base.masters[1]] } })).status).toBe(403)
    const startOwners = { ...base, sessionRecords: [{ ...base.sessionRecords[0], status: 'active' }, base.sessionRecords[1]] }
    expect((await call(CO, 'PUT', 'docs/localCampaigns/c1', { data: startOwners })).status).toBe(403)
    const startOwn = { ...base, sessionRecords: [base.sessionRecords[0], { ...base.sessionRecords[1], status: 'active' }] }
    expect((await call(CO, 'PUT', 'docs/localCampaigns/c1', { data: startOwn })).status).toBe(200)
    expect((await call(CO, 'DELETE', 'docs/localCampaigns/c1')).status).toBe(403)
    expect((await call(OWNER, 'DELETE', 'docs/localCampaigns/c1')).status).toBe(204)
    expect((await call(OWNER, 'GET', 'docs/localCampaigns/c1')).status).toBe(404)
  })

  it('removes access when a master is taken off the campaign', async () => {
    await call(OWNER, 'PUT', 'docs/localCampaigns/c1', { data: campaign() })
    const base = campaign()
    await call(OWNER, 'PUT', 'docs/localCampaigns/c1', { data: { ...base, masters: [base.masters[0]] } })
    expect((await call(CO, 'GET', 'docs/localCampaigns/c1')).status).toBe(404)
    expect((await call(CO, 'GET', 'collections/localCampaigns')).body).toEqual([])
  })

  it('rejects paths outside shared campaigns and unauthenticated requests', async () => {
    expect((await call(OWNER, 'GET', 'docs/localMeta/catalog')).status).toBe(400)
    const anonymous = await handleApi(new Request('https://mb.test/api/me'), { DB: env.DB, ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com', ACCESS_AUD: 'aud' })
    expect(anonymous.status).toBe(401)
  })
})

describe('Cloudflare Access JWT', () => {
  const b64url = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString('base64url')
  async function signed(payload: Record<string, unknown>) {
    const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
    const head = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', kid: 'k1' })))
    const body = b64url(new TextEncoder().encode(JSON.stringify(payload)))
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${head}.${body}`))
    const fetcher = (async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k1' }] }))) as unknown as typeof fetch
    return { token: `${head}.${body}.${b64url(signature)}`, fetcher }
  }
  const env = { ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com', ACCESS_AUD: 'aud-1' }
  beforeEach(() => resetKeyCache())

  it('accepts a valid token and returns the email', async () => {
    const { token, fetcher } = await signed({ aud: ['aud-1'], iss: 'https://team.cloudflareaccess.com', exp: 2_000_000_000, email: 'Owl@Example.com' })
    expect(await verifyAccessJwt(token, env, fetcher, 1_000_000_000_000)).toBe('owl@example.com')
  })

  it('rejects a token for another application or an expired one', async () => {
    const other = await signed({ aud: ['aud-2'], iss: 'https://team.cloudflareaccess.com', exp: 2_000_000_000, email: 'a@b.c' })
    await expect(verifyAccessJwt(other.token, env, other.fetcher, 1_000_000_000_000)).rejects.toThrow('другого приложения')
    resetKeyCache()
    const expired = await signed({ aud: ['aud-1'], iss: 'https://team.cloudflareaccess.com', exp: 1, email: 'a@b.c' })
    await expect(verifyAccessJwt(expired.token, env, expired.fetcher, 1_000_000_000_000)).rejects.toThrow('Срок входа')
  })

  it('rejects a tampered token', async () => {
    const { token, fetcher } = await signed({ aud: ['aud-1'], iss: 'https://team.cloudflareaccess.com', exp: 2_000_000_000, email: 'a@b.c' })
    const [head, , signature] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ aud: ['aud-1'], iss: 'https://team.cloudflareaccess.com', exp: 2_000_000_000, email: 'evil@b.c' })).toString('base64url')
    await expect(verifyAccessJwt(`${head}.${forged}.${signature}`, env, fetcher, 1_000_000_000_000)).rejects.toThrow('Подпись')
  })
})
