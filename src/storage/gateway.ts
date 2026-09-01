/**
 * Target persistence contract for Masterboard domain data.
 *
 * It deliberately models documents, field patches and transactions instead of
 * repository files. The in-memory implementation is used now; a future
 * Firestore adapter can implement the same contract without changing stores.
 */

export type DocumentData = Record<string, unknown>

export interface DocumentSnapshot<T extends DocumentData = DocumentData> {
  path: string
  data: T
  revision: number
}

export interface WritePrecondition {
  revision?: number
}

export interface StorageTransaction {
  get<T extends DocumentData>(path: string): Promise<DocumentSnapshot<T> | null>
  set<T extends DocumentData>(path: string, data: T): void
  patch<T extends DocumentData>(path: string, patch: Partial<T>, precondition?: WritePrecondition): void
  remove(path: string, precondition?: WritePrecondition): void
}

export interface StorageGateway {
  get<T extends DocumentData>(path: string): Promise<DocumentSnapshot<T> | null>
  set<T extends DocumentData>(path: string, data: T): Promise<DocumentSnapshot<T>>
  patch<T extends DocumentData>(
    path: string,
    patch: Partial<T>,
    precondition?: WritePrecondition,
  ): Promise<DocumentSnapshot<T>>
  remove(path: string, precondition?: WritePrecondition): Promise<void>
  /** Return direct document children of a collection, sorted by path. */
  list<T extends DocumentData>(collectionPath: string): Promise<DocumentSnapshot<T>[]>
  /** Commit all writes atomically; an exception leaves storage unchanged. */
  runTransaction<T>(work: (transaction: StorageTransaction) => Promise<T>): Promise<T>
}

export class StorageConflictError extends Error {
  constructor(
    readonly path: string,
    readonly expectedRevision: number,
    readonly actualRevision: number | null,
  ) {
    super(`Storage conflict at ${path}: expected revision ${expectedRevision}, got ${actualRevision ?? 'missing'}`)
    this.name = 'StorageConflictError'
  }
}
