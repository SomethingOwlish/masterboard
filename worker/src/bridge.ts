/**
 * Door to lorebook / lovegame / systemsetup / kk9 / nocturne through lorebridge (contract
 * docs/contracts/lorebridge-masterboard.md, decision E1: service binding).
 * The browser calls /api/ext/*; the Worker adds the shared secret and the
 * master's email checked by Cloudflare Access, and forwards to /mb/*.
 */
export interface BridgeEnv {
  /** Service binding to the lorebridge Worker. */
  LOREBRIDGE?: { fetch(request: Request): Promise<Response> }
  /** `wrangler secret put MASTERBOARD_BRIDGE_SECRET` — the same value in lorebridge. */
  MASTERBOARD_BRIDGE_SECRET?: string
}

export class BridgeUnavailableError extends Error {
  constructor() { super('Связь с внешними системами (Лорбук, ЛавГеймс, КК9, Ноктюрн) не настроена'); this.name = 'BridgeUnavailableError' }
}

// state и session — живое состояние стола КК9 и итоги сессии (этап М4);
// backup — итог резервной копии (GET) и копия сейчас (POST), этап М5.
// schema — поля карточек по типам записей (ТЗ-2, R2); мост без неё отвечает 404.
const ROUTES: Record<string, Array<'GET' | 'POST'>> = { connections: ['GET'], passport: ['GET'], entities: ['GET'], schema: ['GET'], publish: ['POST'], state: ['GET'], session: ['POST'], backup: ['GET', 'POST'] }

/** Forwards `route` (after /api/ext/) to lorebridge; null when the route is unknown. */
export async function forwardToBridge(request: Request, route: string, email: string, env: BridgeEnv): Promise<Response | null> {
  const methods = ROUTES[route]
  if (!methods || !(methods as string[]).includes(request.method)) return null
  const method = request.method as 'GET' | 'POST'
  if (!env.LOREBRIDGE || !env.MASTERBOARD_BRIDGE_SECRET) throw new BridgeUnavailableError()
  const target = new URL(`https://lorebridge/mb/${route}`)
  target.search = new URL(request.url).search
  const outgoing = new Request(target, {
    method,
    headers: {
      'x-masterboard-secret': env.MASTERBOARD_BRIDGE_SECRET,
      'x-masterboard-user': email,
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
    },
    body: method === 'POST' ? await request.text() : undefined,
  })
  const response = await env.LOREBRIDGE.fetch(outgoing)
  // Pass the bridge's answer through as is (errors keep {error, side, kind}); never cache.
  return new Response(response.body, { status: response.status, headers: { 'content-type': response.headers.get('content-type') ?? 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
}
