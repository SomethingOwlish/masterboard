// Minimal promise wrapper over IndexedDB — no dependency, one database with a
// couple of key/value object stores. Everything else builds on these helpers.

const DB_NAME = 'masterboard'
const DB_VERSION = 1

/** Object stores. `files` holds the working copy of repo paths; `secrets` holds
 *  the encrypted PAT + the non-extractable crypto key. */
export const STORE_FILES = 'files'
export const STORE_SECRETS = 'secrets'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_FILES)) db.createObjectStore(STORE_FILES)
      if (!db.objectStoreNames.contains(STORE_SECRETS)) db.createObjectStore(STORE_SECRETS)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = run(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return tx<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>)
}

export function idbPut(store: string, key: string, value: unknown): Promise<void> {
  return tx<IDBValidKey>(store, 'readwrite', (s) => s.put(value, key)).then(() => undefined)
}

export function idbDelete(store: string, key: string): Promise<void> {
  return tx<undefined>(store, 'readwrite', (s) => s.delete(key) as IDBRequest<undefined>).then(() => undefined)
}

export function idbKeys(store: string): Promise<string[]> {
  return tx<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()).then((keys) => keys.map(String))
}
