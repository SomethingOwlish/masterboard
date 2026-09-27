import { AuthError, requestEmail, type AuthEnv } from './auth'
import { internalBackup } from './backup'
import { BridgeUnavailableError, forwardToBridge, type BridgeEnv } from './bridge'
import type { D1Like } from './d1'
import { PermissionError } from './permissions'
import { BadRequestError, ConflictError, DocumentStore, NotFoundError } from './store'
import { PlayerStore } from './players'

export interface Env extends AuthEnv, BridgeEnv {
  DB: D1Like
  /** Static SPA build (`dist/`), served for every non-API path. */
  ASSETS?: { fetch(request: Request): Promise<Response> }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

/**
 * API:
 *   GET    /api/me                       → { email }
 *   GET    /api/collections/localCampaigns → Snapshot[] the master belongs to
 *   GET    /api/docs/<path>              → Snapshot | 404
 *   GET    /api/revisions/<path>         → { revision } | 404 (polled by open screens)
 *   PUT    /api/docs/<path>  { data, expectedRevision? } → Snapshot | 409 { current }
 *   DELETE /api/docs/<path>?expectedRevision=n
 *   GET    /api/players                  → профили игроков для всех мастеров + своя заметка (players.ts)
 *   PUT    /api/players/<id> { data, expectedRevision? } · PUT /api/players/<id>/note { text } · DELETE /api/players/<id>
 *   GET    /api/ext/connections | passport | entities | state | backup, POST /api/ext/publish | session | backup → lorebridge /mb/* (bridge.ts)
 *   POST   /api/internal/backup         → все общие кампании для бэкапа моста; только по общему секрету, без входа (backup.ts)
 */
export async function handleApi(request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url)
  // Служебный вход моста — до проверки Access: привязка сервиса Access не
  // проходит, и почты у неё нет. Право держит общий секрет (backup.ts).
  if (url.pathname === '/api/internal/backup') {
    try { return await internalBackup(request, env) } catch { return json({ error: 'Внутренняя ошибка' }, 500) }
  }
  try {
    const email = await requestEmail(request, env, fetcher)
    const store = new DocumentStore(env.DB, email)
    const route = url.pathname.replace(/^\/api\/?/, '')
    if (route === 'me' && request.method === 'GET') return json({ email })
    if (route.startsWith('ext/')) {
      const forwarded = await forwardToBridge(request, route.slice('ext/'.length), email, env)
      if (forwarded) return forwarded
    }
    if (route === 'players' || route.startsWith('players/')) {
      const players = new PlayerStore(env.DB, email)
      const [, id, part] = route.split('/')
      if (!id && request.method === 'GET') return json(await players.list())
      if (id && part === 'note' && request.method === 'PUT') { const body = await request.json() as { text?: unknown }; return json(await players.note(decodeURIComponent(id), typeof body.text === 'string' ? body.text : '')) }
      if (id && !part && request.method === 'PUT') {
        const body = await request.json() as { data?: unknown; expectedRevision?: number }
        if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) throw new BadRequestError('Нужно поле data с объектом')
        return json(await players.set(decodeURIComponent(id), body.data as Record<string, unknown>, body.expectedRevision))
      }
      if (id && !part && request.method === 'DELETE') { await players.remove(decodeURIComponent(id)); return new Response(null, { status: 204 }) }
    }
    if (route.startsWith('collections/') && request.method === 'GET') return json(await store.list(decodeURIComponent(route.slice('collections/'.length))))
    if (route.startsWith('revisions/') && request.method === 'GET') {
      const revision = await store.revision(decodeURIComponent(route.slice('revisions/'.length)))
      return revision === null ? json({ error: 'Не найдено' }, 404) : json({ revision })
    }
    if (route.startsWith('docs/')) {
      const path = decodeURIComponent(route.slice('docs/'.length))
      if (request.method === 'GET') {
        const snapshot = await store.get(path)
        return snapshot ? json(snapshot) : json({ error: 'Не найдено' }, 404)
      }
      if (request.method === 'PUT') {
        const body = await request.json() as { data?: unknown; expectedRevision?: number }
        if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) throw new BadRequestError('Нужно поле data с объектом')
        return json(await store.set(path, body.data as Record<string, unknown>, body.expectedRevision))
      }
      if (request.method === 'DELETE') {
        const expected = url.searchParams.get('expectedRevision')
        await store.remove(path, expected === null ? undefined : Number(expected))
        return new Response(null, { status: 204 })
      }
    }
    return json({ error: 'Неизвестный запрос' }, 404)
  } catch (error) {
    if (error instanceof AuthError) return json({ error: error.message }, 401)
    if (error instanceof BridgeUnavailableError) return json({ error: error.message, kind: 'unconfigured' }, 501)
    if (error instanceof PermissionError) return json({ error: error.message }, 403)
    if (error instanceof NotFoundError) return json({ error: error.message }, 404)
    if (error instanceof ConflictError) return json({ error: error.message, expected: error.expected, actual: error.actual, current: error.current }, 409)
    if (error instanceof BadRequestError || error instanceof SyntaxError) return json({ error: error.message }, 400)
    return json({ error: 'Внутренняя ошибка' }, 500)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname.startsWith('/api/')) return handleApi(request, env)
    if (env.ASSETS) return env.ASSETS.fetch(request)
    return new Response('Not found', { status: 404 })
  },
}
