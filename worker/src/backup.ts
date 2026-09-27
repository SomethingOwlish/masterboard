import type { D1Like } from './d1'
import { CAMPAIGNS } from './store'

/**
 * Резервная копия (этап М5): lorebridge ночью забирает все общие кампании и
 * кладёт их в приватный репозиторий бэкапа, папкой `мастерборд/`.
 *
 * Мост приходит привязкой сервиса — мимо Cloudflare Access (он стоит на адресе,
 * а не на воркере), — поэтому право здесь держит только общий секрет, тот же
 * `MASTERBOARD_BRIDGE_SECRET`, что у двери `/api/ext/*`, в обратную сторону.
 * Человек сюда не ходит: права мастера не спрашиваются, отдаётся всё.
 */
export interface BackupEnv {
  DB: D1Like
  MASTERBOARD_BRIDGE_SECRET?: string
}

async function digest(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

/** Секрет сошёлся — за постоянное время: сравниваются отпечатки одной длины. */
export async function sameSecret(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(given), digest(expected)])
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

type Row = { path: string; data: string; revision: number; updated_at: string; updated_by: string }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

/** `POST /api/internal/backup` → `{ documents: [{ path, data, revision, updatedAt, updatedBy }] }`. */
export async function internalBackup(request: Request, env: BackupEnv): Promise<Response> {
  if (!env.MASTERBOARD_BRIDGE_SECRET) return json({ error: 'Резервная копия не подключена: у воркера нет общего секрета' }, 501)
  if (request.method !== 'POST') return json({ error: 'Только POST' }, 405)
  const given = request.headers.get('x-masterboard-secret') ?? ''
  if (!given || !(await sameSecret(given, env.MASTERBOARD_BRIDGE_SECRET))) return json({ error: 'Секрет не сходится' }, 401)
  const { results } = await env.DB.prepare(
    'SELECT path, data, revision, updated_at, updated_by FROM documents WHERE collection = ? ORDER BY path',
  ).bind(CAMPAIGNS).all<Row>()
  return json({
    documents: results.map((row) => ({ path: row.path, data: JSON.parse(row.data) as unknown, revision: row.revision, updatedAt: row.updated_at, updatedBy: row.updated_by })),
  })
}
