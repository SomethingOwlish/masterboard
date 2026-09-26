import { newId } from '../model/ids'
import { EXPORT_FORMAT, type LocalCampaignCatalog } from './catalog'
import { mergeCampaign, type MergeConflict } from './merge'
import { normalizeCampaign } from './normalize'
import type { LocalCampaignRecord } from './types'

interface Snapshot { path: string; data: Record<string, unknown>; revision: number }

export class RemoteError extends Error { constructor(message: string, readonly status: number) { super(message); this.name = 'RemoteError' } }

/** Thin client for the Masterboard Worker API (/api). */
export class MasterboardApi {
  constructor(private readonly fetcher: typeof fetch = (...args) => fetch(...args), private readonly base = '/api') {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }> {
    const response = await this.fetcher(`${this.base}/${path}`, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' })
    const text = await response.text()
    let parsed: unknown = null
    try { parsed = text ? JSON.parse(text) : null } catch { throw new RemoteError('Сервер ответил не JSON', response.status) }
    if (!response.ok && response.status !== 409 && !(method === 'GET' && response.status === 404)) throw new RemoteError((parsed as { error?: string } | null)?.error ?? `Ошибка сервера ${response.status}`, response.status)
    return { status: response.status, body: parsed as T }
  }

  /** The signed-in email, or null when this build runs without the Worker (plain static hosting, dev server). */
  async me(): Promise<string | null> {
    try {
      const response = await this.fetcher(`${this.base}/me`, { credentials: 'same-origin', signal: AbortSignal.timeout(4000) })
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return null
      return ((await response.json()) as { email?: string }).email ?? null
    } catch { return null }
  }

  list = async () => (await this.call<Snapshot[]>('GET', 'collections/localCampaigns')).body
  get = async (id: string) => { const result = await this.call<Snapshot>('GET', `docs/localCampaigns/${id}`); return result.status === 404 ? null : result.body }
  put = (id: string, data: LocalCampaignRecord, expectedRevision?: number) => this.call<Snapshot & { current?: Snapshot | null }>('PUT', `docs/localCampaigns/${id}`, { data, expectedRevision })
  remove = (id: string) => this.call<null>('DELETE', `docs/localCampaigns/${id}`)
}

export class SharedConflictError extends Error {
  constructor(readonly conflicts: MergeConflict[]) {
    super(`Другой мастер изменил то же самое: ${conflicts.map((item) => item.path).join(', ')}. Оставлена версия с сервера.`)
    this.name = 'SharedConflictError'
  }
}

/**
 * Shared campaigns on the Worker, plus the browser catalog for campaigns that
 * are not shared. Writes are conditional on the last seen revision; on a clash
 * the edit is merged with the server version (decision I4).
 */
export interface SharedAccess {
  /** The signed-in master (Cloudflare Access). */
  email: string
  isShared(id: string): boolean
  /** Uploads a browser campaign; the signed-in master becomes its owner. */
  share(id: string): Promise<LocalCampaignRecord>
}

export type CampaignCatalog = LocalCampaignCatalog & { shared?: SharedAccess }

/** Shared catalog when the Worker answers with a signed-in email, otherwise the browser catalog. */
export async function resolveCatalog(local: LocalCampaignCatalog, api = new MasterboardApi()): Promise<CampaignCatalog> {
  const email = await api.me()
  return email ? createSharedCatalog(local, api, email) : local
}

export function createSharedCatalog(local: LocalCampaignCatalog, api: MasterboardApi, email: string): LocalCampaignCatalog & { shared: SharedAccess } {
  const known = new Map<string, { revision: number; data: LocalCampaignRecord }>()
  const remember = (snapshot: Snapshot) => {
    const campaign = normalizeCampaign(snapshot.data, new Date().toISOString())
    if (campaign) known.set(campaign.id, { revision: snapshot.revision, data: campaign })
    return campaign
  }

  const writeShared = async (campaign: LocalCampaignRecord): Promise<LocalCampaignRecord> => {
    const seen = known.get(campaign.id)
    const next = { ...campaign, updatedAt: new Date().toISOString() }
    const result = await api.put(campaign.id, next, seen?.revision ?? 0)
    if (result.status !== 409) return remember(result.body) ?? next
    const current = result.body.current
    if (!current || !seen) throw new SharedConflictError([{ path: '(документ)', mine: next, theirs: current?.data }])
    const theirs = normalizeCampaign(current.data, next.updatedAt) ?? seen.data
    // updatedAt is bookkeeping, not an edit: compare content only, then stamp the result.
    const merge = mergeCampaign(seen.data as unknown as Record<string, unknown>, { ...next, updatedAt: seen.data.updatedAt } as unknown as Record<string, unknown>, theirs as unknown as Record<string, unknown>)
    const merged = { ...merge.merged, updatedAt: next.updatedAt }
    const { conflicts } = merge
    known.set(campaign.id, { revision: current.revision, data: theirs })
    const retried = await api.put(campaign.id, merged as unknown as LocalCampaignRecord, current.revision)
    if (retried.status === 409) throw new SharedConflictError([{ path: '(документ)', mine: merged, theirs: retried.body.current?.data }])
    const saved = remember(retried.body) ?? (merged as unknown as LocalCampaignRecord)
    if (conflicts.length) throw Object.assign(new SharedConflictError(conflicts), { saved })
    return saved
  }

  const shared: SharedAccess = {
    email,
    isShared: (id: string) => known.has(id),
    async share(id: string) {
      const campaign = await local.find(id)
      if (!campaign) throw new Error('Кампания не найдена')
      const owner = campaign.masters.find((master) => master.role === 'owner')
      const masters = campaign.masters.map((master) => master === owner ? { ...master, email } : master)
      const target = known.has(id) || (await api.get(id)) ? { ...campaign, id: newId('local') } : campaign
      const result = await api.put(target.id, { ...target, masters }, 0)
      if (result.status === 409) throw new RemoteError('Кампания с таким id уже есть на сервере', 409)
      const saved = remember(result.body) ?? { ...target, masters }
      await local.remove(id)
      return saved
    },
  }

  const catalog = {
    shared,
    async load() {
      const [remote, browser] = await Promise.all([api.list(), local.load()])
      known.clear()
      const campaigns = remote.map(remember).filter((item): item is LocalCampaignRecord => Boolean(item))
      return { campaigns: [...campaigns, ...browser.campaigns.filter((item) => !known.has(item.id))], quarantined: browser.quarantined }
    },
    async find(id: string) {
      const snapshot = await api.get(id)
      if (snapshot) return remember(snapshot)
      return local.find(id)
    },
    create: (name: string, idea: string) => local.create(name, idea),
    async update(campaign: LocalCampaignRecord) {
      return known.has(campaign.id) ? writeShared(campaign) : local.update(campaign)
    },
    async remove(id: string) {
      if (known.has(id)) { await api.remove(id); known.delete(id); return }
      await local.remove(id)
    },
    async exportCampaign(id: string) {
      const campaign = await catalog.find(id)
      if (!campaign) throw new Error('Кампания не найдена')
      return JSON.stringify({ format: EXPORT_FORMAT, exportedAt: new Date().toISOString(), campaign }, null, 2)
    },
    importCampaign: (json: string) => local.importCampaign(json),
    clearQuarantine: () => local.clearQuarantine(),
  }
  return catalog
}
