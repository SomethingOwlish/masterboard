import type { D1Like } from './d1'
import { BadRequestError, ConflictError, NotFoundError } from './store'

const ID = /^[A-Za-z0-9_-]{1,120}$/
const assertId = (id: string) => { if (!ID.test(id)) throw new BadRequestError(`Недопустимый id игрока: ${id}`) }

/** A profile as the directory sends it: the shared part plus the signed-in master's own note. */
export interface PlayerEntry { id: string; data: Record<string, unknown>; revision: number; updatedBy: string; myNote: string }
type Row = { id: string; data: string; revision: number; updated_by: string; note: string | null }

/**
 * Player profiles (ТЗ-2, R11): one directory for every signed-in master.
 * The profile is shared and written with a revision like campaigns; the
 * personal note is stored per master and never leaves for anyone else.
 */
export class PlayerStore {
  constructor(private readonly db: D1Like, private readonly email: string, private readonly now: () => string = () => new Date().toISOString()) {}

  private get me() { return this.email.toLocaleLowerCase() }

  async list(): Promise<PlayerEntry[]> {
    const { results } = await this.db.prepare(
      'SELECT p.id, p.data, p.revision, p.updated_by, n.text AS note FROM players p LEFT JOIN player_notes n ON n.player_id = p.id AND n.email = ? ORDER BY p.id',
    ).bind(this.me).all<Row>()
    return results.map((row) => ({ id: row.id, data: JSON.parse(row.data) as Record<string, unknown>, revision: row.revision, updatedBy: row.updated_by, myNote: row.note ?? '' }))
  }

  private async entry(id: string): Promise<PlayerEntry | null> {
    return (await this.list()).find((item) => item.id === id) ?? null
  }

  /** `expectedRevision` 0 — a new profile; a number — must still be at that revision (409 with the current one otherwise). */
  async set(id: string, data: Record<string, unknown>, expectedRevision?: number): Promise<PlayerEntry> {
    assertId(id)
    const current = await this.db.prepare('SELECT revision FROM players WHERE id = ?').bind(id).first<{ revision: number }>()
    if (expectedRevision !== undefined && (current?.revision ?? 0) !== expectedRevision) {
      const latest = await this.entry(id)
      throw new ConflictError(`players/${id}`, expectedRevision, current?.revision ?? null, latest ? { path: `players/${id}`, data: latest.data, revision: latest.revision, updatedBy: latest.updatedBy } : null)
    }
    const revision = (current?.revision ?? 0) + 1
    await this.db.prepare('INSERT INTO players (id, data, revision, updated_at, updated_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, revision = excluded.revision, updated_at = excluded.updated_at, updated_by = excluded.updated_by')
      .bind(id, JSON.stringify({ ...data, id }), revision, this.now(), this.me).run()
    return (await this.entry(id))!
  }

  async note(id: string, text: string): Promise<PlayerEntry> {
    assertId(id)
    if (!await this.db.prepare('SELECT id FROM players WHERE id = ?').bind(id).first()) throw new NotFoundError(`players/${id}`)
    if (text.trim()) await this.db.prepare('INSERT INTO player_notes (player_id, email, text, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(player_id, email) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at').bind(id, this.me, text, this.now()).run()
    else await this.db.prepare('DELETE FROM player_notes WHERE player_id = ? AND email = ?').bind(id, this.me).run()
    return (await this.entry(id))!
  }

  async remove(id: string): Promise<void> {
    assertId(id)
    await this.db.batch([this.db.prepare('DELETE FROM player_notes WHERE player_id = ?').bind(id), this.db.prepare('DELETE FROM players WHERE id = ?').bind(id)])
  }
}
