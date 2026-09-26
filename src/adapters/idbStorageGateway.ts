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

export interface IdbStorageGatewayOptions {
  /** Separate from the legacy `masterboard` database so their versions never collide. */
  dbName?: string
  factory?: IDBFactory
}

const STORE = 'documents'

const normalize = (path: string): string => path.replace(/^\/+|\/+$/g, '')

function snapshot<T extends DocumentData>(path: string, stored: StoredDocument): DocumentSnapshot<T> {
  return { path, data: structuredClone(stored.data) as T, revision: stored.revision }
}

function assertRevision(path: string, stored: StoredDocument | undefined, precondition?: WritePrecondition): void {
  if (precondition?.revision === undefined) return
  const actual = stored?.revision ?? null
  if (actual !== precondition.revision) throw new StorageConflictError(path, precondition.revision, actual)
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

/**
 * Browser persistence for the StorageGateway contract. Documents live in one
 * object store keyed by path. Writes are serialized per gateway instance, and
 * transactions buffer their writes and commit them in one IndexedDB transaction.
 */
export class IdbStorageGateway implements StorageGateway {
  private db: Promise<IDBDatabase> | null = null
  private tail: Promise<unknown> = Promise.resolve()
  private readonly dbName: string
  private readonly factory: IDBFactory

  constructor(options: IdbStorageGatewayOptions = {}) {
    this.dbName = options.dbName ?? 'masterboard-documents'
    this.factory = options.factory ?? indexedDB
  }

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      const req = this.factory.open(this.dbName, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
      }
      this.db = request(req)
      this.db.catch(() => { this.db = null })
    }
    return this.db
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work, work)
    this.tail = result.then(() => undefined, () => undefined)
    return result
  }

  private async read(path: string): Promise<StoredDocument | undefined> {
    const db = await this.open()
    return request(db.transaction(STORE, 'readonly').objectStore(STORE).get(path)) as Promise<StoredDocument | undefined>
  }

  private async commit(writes: Map<string, StoredDocument | null>): Promise<void> {
    const db = await this.open()
    const transaction = db.transaction(STORE, 'readwrite')
    const store = transaction.objectStore(STORE)
    for (const [path, stored] of writes) {
      if (stored) store.put(stored, path)
      else store.delete(path)
    }
    await done(transaction)
  }

  async get<T extends DocumentData>(path: string): Promise<DocumentSnapshot<T> | null> {
    const key = normalize(path)
    const stored = await this.read(key)
    return stored ? snapshot<T>(key, stored) : null
  }

  set<T extends DocumentData>(path: string, data: T): Promise<DocumentSnapshot<T>> {
    const key = normalize(path)
    return this.serial(async () => {
      const current = await this.read(key)
      const stored = { data: structuredClone(data), revision: (current?.revision ?? 0) + 1 }
      await this.commit(new Map([[key, stored]]))
      return snapshot<T>(key, stored)
    })
  }

  patch<T extends DocumentData>(path: string, patch: Partial<T>, precondition?: WritePrecondition): Promise<DocumentSnapshot<T>> {
    const key = normalize(path)
    return this.serial(async () => {
      const current = await this.read(key)
      assertRevision(key, current, precondition)
      if (!current) throw new Error(`Cannot patch missing document ${key}`)
      const stored = { data: { ...current.data, ...structuredClone(patch) }, revision: current.revision + 1 }
      await this.commit(new Map([[key, stored]]))
      return snapshot<T>(key, stored)
    })
  }

  remove(path: string, precondition?: WritePrecondition): Promise<void> {
    const key = normalize(path)
    return this.serial(async () => {
      assertRevision(key, await this.read(key), precondition)
      await this.commit(new Map([[key, null]]))
    })
  }

  async list<T extends DocumentData>(collectionPath: string): Promise<DocumentSnapshot<T>[]> {
    const prefix = `${normalize(collectionPath)}/`
    const db = await this.open()
    const store = db.transaction(STORE, 'readonly').objectStore(STORE)
    const range = IDBKeyRange.bound(prefix, `${prefix}￿`)
    const [keys, values] = await Promise.all([request(store.getAllKeys(range)), request(store.getAll(range))])
    return keys
      .map((key, index) => [String(key), values[index] as StoredDocument] as const)
      .filter(([key]) => !key.slice(prefix.length).includes('/'))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, stored]) => snapshot<T>(key, stored))
  }

  runTransaction<T>(work: (transaction: StorageTransaction) => Promise<T>): Promise<T> {
    return this.serial(async () => {
      const draft = new Map<string, StoredDocument | null>()
      const writes = new Map<string, StoredDocument | null>()
      const current = (key: string): StoredDocument | undefined => {
        if (!draft.has(key)) throw new Error(`Read ${key} inside the transaction before writing it`)
        return draft.get(key) ?? undefined
      }
      const transaction: StorageTransaction = {
        get: async <D extends DocumentData>(path: string) => {
          const key = normalize(path)
          if (!draft.has(key)) draft.set(key, (await this.read(key)) ?? null)
          const stored = draft.get(key)
          return stored ? snapshot<D>(key, stored) : null
        },
        set: <D extends DocumentData>(path: string, data: D) => {
          const key = normalize(path)
          const stored = { data: structuredClone(data), revision: ((draft.get(key) ?? undefined)?.revision ?? 0) + 1 }
          draft.set(key, stored)
          writes.set(key, stored)
        },
        patch: <D extends DocumentData>(path: string, patch: Partial<D>, precondition?: WritePrecondition) => {
          const key = normalize(path)
          const existing = current(key)
          assertRevision(key, existing, precondition)
          if (!existing) throw new Error(`Cannot patch missing document ${key}`)
          const stored = { data: { ...existing.data, ...structuredClone(patch) }, revision: existing.revision + 1 }
          draft.set(key, stored)
          writes.set(key, stored)
        },
        remove: (path: string, precondition?: WritePrecondition) => {
          const key = normalize(path)
          assertRevision(key, current(key), precondition)
          draft.set(key, null)
          writes.set(key, null)
        },
      }
      const result = await work(transaction)
      if (writes.size) await this.commit(writes)
      return result
    })
  }
}
