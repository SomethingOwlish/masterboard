import type { D1Like } from './d1'
import { assertCanDelete, assertCanWrite, memberOf, type CampaignLike } from './permissions'

/** Only shared campaign documents live on the server; everything else stays in the browser. */
export const CAMPAIGNS = 'localCampaigns'
const PATH = /^localCampaigns\/[A-Za-z0-9_-]{1,120}$/

/** `updatedBy` — who wrote this revision (the signed-in email). */
export interface Snapshot { path: string; data: Record<string, unknown>; revision: number; updatedBy?: string }

export class NotFoundError extends Error { constructor(path: string) { super(`Документ ${path} не найден`); this.name = 'NotFoundError' } }
export class ConflictError extends Error {
  constructor(readonly path: string, readonly expected: number, readonly actual: number | null, readonly current: Snapshot | null) {
    super(`Документ ${path} уже изменён: ожидалась ревизия ${expected}, сейчас ${actual ?? 'нет документа'}`)
    this.name = 'ConflictError'
  }
}
export class BadRequestError extends Error { constructor(message: string) { super(message); this.name = 'BadRequestError' } }

type Row = { path: string; data: string; revision: number; updated_by?: string }

export function assertPath(path: string): void {
  if (!PATH.test(path)) throw new BadRequestError(`Недопустимый путь: ${path}`)
}

const toSnapshot = (row: Row): Snapshot => ({ path: row.path, data: JSON.parse(row.data) as Record<string, unknown>, revision: row.revision, ...(row.updated_by ? { updatedBy: row.updated_by } : {}) })

/** D1 implementation of the documents the StorageGateway contract needs, scoped to one signed-in master. */
export class DocumentStore {
  constructor(private readonly db: D1Like, private readonly email: string, private readonly now: () => string = () => new Date().toISOString()) {}

  private async row(path: string): Promise<Snapshot | null> {
    const row = await this.db.prepare('SELECT path, data, revision, updated_by FROM documents WHERE path = ?').bind(path).first<Row>()
    return row ? toSnapshot(row) : null
  }

  private async assertMember(snapshot: Snapshot): Promise<void> {
    if (!memberOf(snapshot.data as CampaignLike, this.email)) throw new NotFoundError(snapshot.path)
  }

  async get(path: string): Promise<Snapshot | null> {
    assertPath(path)
    const snapshot = await this.row(path)
    if (!snapshot) return null
    await this.assertMember(snapshot)
    return snapshot
  }

  /**
   * The current revision only, for open screens that poll for other masters'
   * edits: no document body is read or sent. Null when the document is missing
   * or the master is not on the campaign.
   */
  async revision(path: string): Promise<number | null> {
    assertPath(path)
    const row = await this.db.prepare(
      'SELECT d.revision FROM documents d JOIN campaign_members m ON m.campaign_path = d.path WHERE d.path = ? AND m.email = ?',
    ).bind(path, this.email.toLocaleLowerCase()).first<{ revision: number }>()
    return row?.revision ?? null
  }

  /** Campaigns the signed-in master belongs to. */
  async list(collection: string): Promise<Snapshot[]> {
    if (collection !== CAMPAIGNS) throw new BadRequestError(`Недопустимая коллекция: ${collection}`)
    const { results } = await this.db.prepare(
      'SELECT d.path, d.data, d.revision, d.updated_by FROM documents d JOIN campaign_members m ON m.campaign_path = d.path WHERE d.collection = ? AND m.email = ? ORDER BY d.path',
    ).bind(collection, this.email.toLocaleLowerCase()).all<Row>()
    return results.map(toSnapshot)
  }

  /**
   * Replaces a document. `expectedRevision` makes the write conditional:
   * 0 means "must not exist yet", a number means "must still be at that revision".
   */
  async set(path: string, data: Record<string, unknown>, expectedRevision?: number): Promise<Snapshot> {
    assertPath(path)
    const current = await this.row(path)
    if (expectedRevision !== undefined && (current?.revision ?? 0) !== expectedRevision) {
      if (current) await this.assertMember(current)
      throw new ConflictError(path, expectedRevision, current?.revision ?? null, current)
    }
    if (current) await this.assertMember(current)
    assertCanWrite(current ? current.data as CampaignLike : null, data as CampaignLike, this.email)
    const revision = (current?.revision ?? 0) + 1
    const members = ((data as CampaignLike).masters ?? []).filter((master) => master.email)
    await this.db.batch([
      current
        ? this.db.prepare('UPDATE documents SET data = ?, revision = ?, updated_at = ?, updated_by = ? WHERE path = ? AND revision = ?').bind(JSON.stringify(data), revision, this.now(), this.email, path, current.revision)
        : this.db.prepare('INSERT INTO documents (path, collection, data, revision, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)').bind(path, CAMPAIGNS, JSON.stringify(data), revision, this.now(), this.email),
      this.db.prepare('DELETE FROM campaign_members WHERE campaign_path = ?').bind(path),
      ...members.map((master) => this.db.prepare('INSERT OR REPLACE INTO campaign_members (campaign_path, email, role) VALUES (?, ?, ?)').bind(path, String(master.email).trim().toLocaleLowerCase(), master.role)),
    ])
    const written = await this.row(path)
    if (!written || written.revision !== revision) throw new ConflictError(path, current?.revision ?? 0, written?.revision ?? null, written)
    return written
  }

  async remove(path: string, expectedRevision?: number): Promise<void> {
    assertPath(path)
    const current = await this.row(path)
    if (!current) return
    await this.assertMember(current)
    if (expectedRevision !== undefined && current.revision !== expectedRevision) throw new ConflictError(path, expectedRevision, current.revision, current)
    assertCanDelete(current.data as CampaignLike, this.email)
    await this.db.batch([
      this.db.prepare('DELETE FROM documents WHERE path = ?').bind(path),
      this.db.prepare('DELETE FROM campaign_members WHERE campaign_path = ?').bind(path),
    ])
  }
}
