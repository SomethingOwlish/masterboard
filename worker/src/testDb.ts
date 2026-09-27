import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import type { D1Like, D1Statement } from './d1'

/** In-memory D1 stand-in on node:sqlite with the real migrations applied. Tests only. */
export function testDb(): D1Like {
  const db = new DatabaseSync(':memory:')
  for (const migration of ['0001_documents.sql', '0002_players.sql']) db.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'))
  const statement = (sql: string, params: unknown[] = []): D1Statement & { exec(): unknown } => ({
    bind: (...values: unknown[]) => statement(sql, values),
    first: async <T>() => (db.prepare(sql).get(...(params as never[])) as T | undefined) ?? null,
    all: async <T>() => ({ results: db.prepare(sql).all(...(params as never[])) as T[] }),
    run: async () => db.prepare(sql).run(...(params as never[])),
    exec: () => db.prepare(sql).run(...(params as never[])),
  })
  return {
    prepare: (sql) => statement(sql),
    batch: async (statements) => {
      db.exec('BEGIN')
      try {
        const results = statements.map((item) => (item as ReturnType<typeof statement>).exec())
        db.exec('COMMIT')
        return results
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
  }
}
