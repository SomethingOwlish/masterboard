// StorageAdapter backed by IndexedDB — the always-available working copy. Paths
// are stored verbatim as keys; `list` derives immediate children by prefix.

import { STORE_FILES, idbDelete, idbGet, idbKeys, idbPut } from '../storage/idb'
import type { Json, StorageAdapter } from './types'

export class IdbStorageAdapter implements StorageAdapter {
  async read(path: string): Promise<Json | null> {
    const value = await idbGet<Json>(STORE_FILES, path)
    return value === undefined ? null : value
  }

  async write(path: string, data: Json): Promise<void> {
    await idbPut(STORE_FILES, path, data)
  }

  async remove(path: string): Promise<void> {
    await idbDelete(STORE_FILES, path)
  }

  async list(prefix: string): Promise<string[]> {
    const normalized = prefix.endsWith('/') ? prefix : `${prefix}/`
    const keys = await idbKeys(STORE_FILES)
    const children = new Set<string>()
    for (const key of keys) {
      if (!key.startsWith(normalized)) continue
      const rest = key.slice(normalized.length)
      const slash = rest.indexOf('/')
      children.add(slash === -1 ? rest : rest.slice(0, slash))
    }
    return [...children]
  }
}
