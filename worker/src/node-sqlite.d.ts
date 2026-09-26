// Minimal typing for node:sqlite (Node 22), used only by the test D1 stand-in.
declare module 'node:sqlite' {
  interface StatementSync { run(...params: unknown[]): unknown; get(...params: unknown[]): unknown; all(...params: unknown[]): unknown[] }
  export class DatabaseSync {
    constructor(path: string)
    exec(sql: string): void
    prepare(sql: string): StatementSync
  }
}
