// The sync layer (DESIGN.md §3). IndexedDB is the working copy; GitHub is the
// synced source of truth.
//   read  = fetch from GitHub when online + configured (mirror into IDB),
//           else fall back to the IDB working copy.
//   write = write IDB immediately + debounce a commit to GitHub.
// Last-write-wins; offline edits persist locally and push on the next write.

import { IdbStorageAdapter } from '../adapters/idbStorage'
import type { Json } from '../adapters/types'
import { useConfig } from '../store/config'

const PUSH_DEBOUNCE_MS = 1500

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline'

class Repository {
  private idb = new IdbStorageAdapter()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private latest = new Map<string, Json>()
  private listeners = new Set<(s: SyncState) => void>()
  private state: SyncState = 'idle'
  private lastError: string | null = null

  onSync(fn: (s: SyncState) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private setState(s: SyncState, error?: unknown) {
    this.state = s
    if (s === 'error') {
      this.lastError = error instanceof Error ? error.message : error ? String(error) : 'Unknown error'
      console.warn('[masterboard] sync error:', this.lastError)
    } else if (s === 'idle') {
      this.lastError = null
    }
    for (const fn of this.listeners) fn(s)
  }

  getState(): SyncState {
    return this.state
  }

  getError(): string | null {
    return this.lastError
  }

  private online(): boolean {
    return typeof navigator === 'undefined' || navigator.onLine
  }

  async read(path: string): Promise<Json | null> {
    const remote = this.online() ? useConfig.getState().adapter() : null
    if (remote) {
      try {
        const data = await remote.read(path)
        if (data !== null) {
          await this.idb.write(path, data) // mirror into the working copy
          return data
        }
      } catch (e) {
        this.setState('error', e)
        // fall through to the local working copy
      }
    }
    return this.idb.read(path)
  }

  async write(path: string, data: Json): Promise<void> {
    await this.idb.write(path, data)
    this.latest.set(path, data)
    this.queuePush(path)
  }

  async remove(path: string): Promise<void> {
    await this.idb.remove(path)
    const remote = this.online() ? useConfig.getState().adapter() : null
    if (!remote) return
    try {
      await remote.remove(path)
    } catch (e) {
      this.setState('error', e)
    }
  }

  async list(prefix: string): Promise<string[]> {
    const remote = this.online() ? useConfig.getState().adapter() : null
    if (remote) {
      try {
        const names = await remote.list(prefix)
        if (names.length) return names
      } catch (e) {
        this.setState('error', e)
      }
    }
    return this.idb.list(prefix)
  }

  private queuePush(path: string): void {
    const existing = this.timers.get(path)
    if (existing) clearTimeout(existing)
    this.timers.set(
      path,
      setTimeout(() => {
        this.timers.delete(path)
        void this.push(path)
      }, PUSH_DEBOUNCE_MS),
    )
  }

  private async push(path: string): Promise<void> {
    if (!this.online()) {
      this.setState('offline')
      return
    }
    const remote = useConfig.getState().adapter()
    if (!remote) {
      this.setState('idle') // not configured for sync; local-only is fine
      return
    }
    const data = this.latest.get(path)
    if (data === undefined) return
    this.setState('syncing')
    try {
      await remote.write(path, data)
      this.setState('idle')
    } catch (e) {
      this.setState('error', e)
    }
  }

  /** Force any pending debounced pushes to flush now (e.g. before unload). */
  async flush(): Promise<void> {
    const paths = [...this.timers.keys()]
    for (const path of paths) {
      const timer = this.timers.get(path)
      if (timer) clearTimeout(timer)
      this.timers.delete(path)
      await this.push(path)
    }
  }
}

export const repo = new Repository()
