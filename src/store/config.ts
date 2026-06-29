// App-level configuration: which GitHub repo to sync to and under which GM
// handle. Non-secret fields live in localStorage; the PAT is handled separately
// by storage/secrets.ts (encrypted in IndexedDB). The token here is held only in
// memory after being loaded/entered, never persisted in plaintext.

import { create } from 'zustand'
import { GitHubStorageAdapter, type GitHubConfig } from '../adapters/github'
import { clearToken, getToken, hasToken, setToken } from '../storage/secrets'

const LS_KEY = 'mb.config'

export interface RepoConfig {
  gmHandle: string
  owner: string
  repo: string
  branch: string
  imgurClientId: string
}

const EMPTY: RepoConfig = { gmHandle: '', owner: '', repo: '', branch: 'main', imgurClientId: '' }

function loadPersisted(): RepoConfig {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return EMPTY
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<RepoConfig>) }
  } catch {
    return EMPTY
  }
}

function persist(cfg: RepoConfig): void {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg))
}

interface ConfigState {
  config: RepoConfig
  /** In-memory token; null when none is stored. */
  token: string | null
  tokenLoaded: boolean
  /** True once a token + repo coordinates are present. */
  isConnected: () => boolean
  githubConfig: () => GitHubConfig | null
  adapter: () => GitHubStorageAdapter | null
  hydrate: () => Promise<void>
  saveConfig: (patch: Partial<RepoConfig>) => void
  saveToken: (token: string) => Promise<void>
  clearTokenValue: () => Promise<void>
}

export const useConfig = create<ConfigState>((set, get) => ({
  config: loadPersisted(),
  token: null,
  tokenLoaded: false,

  isConnected: () => {
    const { config, token } = get()
    return Boolean(token && config.owner && config.repo && config.gmHandle)
  },

  githubConfig: () => {
    const { config, token } = get()
    if (!token || !config.owner || !config.repo) return null
    return { token, owner: config.owner, repo: config.repo, branch: config.branch || 'main' }
  },

  adapter: () => {
    const cfg = get().githubConfig()
    return cfg ? new GitHubStorageAdapter(cfg) : null
  },

  hydrate: async () => {
    const token = (await hasToken()) ? await getToken() : null
    set({ token, tokenLoaded: true })
  },

  saveConfig: (patch) => {
    const next = { ...get().config, ...patch }
    persist(next)
    set({ config: next })
  },

  saveToken: async (token) => {
    await setToken(token)
    set({ token: token || null })
  },

  clearTokenValue: async () => {
    await clearToken()
    set({ token: null })
  },
}))
