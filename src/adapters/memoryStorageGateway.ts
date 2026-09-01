import {
  StorageConflictError,
  type DocumentData,
  type DocumentSnapshot,
  type StorageGateway,
  type StorageTransaction,
  type WritePrecondition,
} from '../storage/gateway'

interface StoredDocument {
  data: DocumentData
  revision: number
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function normalize(path: string): string {
  return path.replace(/^\/+|\/+$/g, '')
}

function snapshot<T extends DocumentData>(path: string, stored: StoredDocument): DocumentSnapshot<T> {
  return { path, data: clone(stored.data) as T, revision: stored.revision }
}

function assertRevision(path: string, stored: StoredDocument | undefined, precondition?: WritePrecondition): void {
  if (precondition?.revision === undefined) return
  const actual = stored?.revision ?? null
  if (actual !== precondition.revision) {
    throw new StorageConflictError(path, precondition.revision, actual)
  }
}

function directChild(collectionPath: string, documentPath: string): boolean {
  const prefix = `${normalize(collectionPath)}/`
  if (!documentPath.startsWith(prefix)) return false
  return !documentPath.slice(prefix.length).includes('/')
}

/** Deterministic Firestore-shaped storage for tests and local development. */
export class MemoryStorageGateway implements StorageGateway {
  private documents = new Map<string, StoredDocument>()
  private transactionTail: Promise<unknown> = Promise.resolve()

  constructor(seed: Record<string, DocumentData> = {}) {
    for (const [path, data] of Object.entries(seed)) {
      this.documents.set(normalize(path), { data: clone(data), revision: 1 })
    }
  }

  async get<T extends DocumentData>(path: string): Promise<DocumentSnapshot<T> | null> {
    const key = normalize(path)
    const stored = this.documents.get(key)
    return stored ? snapshot<T>(key, stored) : null
  }

  async set<T extends DocumentData>(path: string, data: T): Promise<DocumentSnapshot<T>> {
    const key = normalize(path)
    const current = this.documents.get(key)
    const stored = { data: clone(data), revision: (current?.revision ?? 0) + 1 }
    this.documents.set(key, stored)
    return snapshot<T>(key, stored)
  }

  async patch<T extends DocumentData>(
    path: string,
    patch: Partial<T>,
    precondition?: WritePrecondition,
  ): Promise<DocumentSnapshot<T>> {
    const key = normalize(path)
    const current = this.documents.get(key)
    assertRevision(key, current, precondition)
    if (!current) throw new Error(`Cannot patch missing document ${key}`)
    const stored = {
      data: { ...current.data, ...clone(patch) },
      revision: current.revision + 1,
    }
    this.documents.set(key, stored)
    return snapshot<T>(key, stored)
  }

  async remove(path: string, precondition?: WritePrecondition): Promise<void> {
    const key = normalize(path)
    const current = this.documents.get(key)
    assertRevision(key, current, precondition)
    this.documents.delete(key)
  }

  async list<T extends DocumentData>(collectionPath: string): Promise<DocumentSnapshot<T>[]> {
    return [...this.documents.entries()]
      .filter(([path]) => directChild(collectionPath, path))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, stored]) => snapshot<T>(path, stored))
  }

  runTransaction<T>(work: (transaction: StorageTransaction) => Promise<T>): Promise<T> {
    const execute = async (): Promise<T> => {
      const draft = new Map<string, StoredDocument>(
        [...this.documents].map(([path, stored]) => [path, clone(stored)]),
      )
      const transaction: StorageTransaction = {
        get: async <D extends DocumentData>(path: string) => {
          const key = normalize(path)
          const stored = draft.get(key)
          return stored ? snapshot<D>(key, stored) : null
        },
        set: <D extends DocumentData>(path: string, data: D) => {
          const key = normalize(path)
          const current = draft.get(key)
          draft.set(key, { data: clone(data), revision: (current?.revision ?? 0) + 1 })
        },
        patch: <D extends DocumentData>(path: string, patch: Partial<D>, precondition?: WritePrecondition) => {
          const key = normalize(path)
          const current = draft.get(key)
          assertRevision(key, current, precondition)
          if (!current) throw new Error(`Cannot patch missing document ${key}`)
          draft.set(key, { data: { ...current.data, ...clone(patch) }, revision: current.revision + 1 })
        },
        remove: (path: string, precondition?: WritePrecondition) => {
          const key = normalize(path)
          const current = draft.get(key)
          assertRevision(key, current, precondition)
          draft.delete(key)
        },
      }
      const result = await work(transaction)
      this.documents = draft
      return result
    }

    const result = this.transactionTail.then(execute, execute)
    this.transactionTail = result.then(() => undefined, () => undefined)
    return result
  }
}
