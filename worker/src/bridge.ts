/**
 * Door to lorebook / lovegame / systemsetup through lorebridge (contract
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
  constructor() { super('Связь с Лорбуком и ЛавГеймс не настроена'); this.name = 'BridgeUnavailableError' }
}

const ROUTES: Record<string, 'GET' | 'POST'> = { connections: 'GET', passport: 'GET', entities: 'GET', publish: 'POST' }

/** Forwards `route` (after /api/ext/) to lorebridge; null when the route is unknown. */
export async function forwardToBridge(request: Request, route: string, email: string, env: BridgeEnv): Promise<Response | null> {
  const method = ROUTES[route]
  if (!method || request.method !== method) return null
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
