/** The slice of the D1 API the Worker uses; lets tests run on node:sqlite. */
export interface D1Result<T> { results: T[] }
export interface D1Statement {
  bind(...values: unknown[]): D1Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  run(): Promise<unknown>
}
export interface D1Like {
  prepare(sql: string): D1Statement
  /** Runs the statements atomically. */
  batch(statements: D1Statement[]): Promise<unknown[]>
}
