// StorageAdapter over the GitHub Contents API. One shared private repo holds
// every GM's folder; writes are individual commits (history comes free from git,
// last-write-wins per DESIGN.md §3). File SHAs are cached so updates don't need
// an extra round-trip on every write.

import type { Json, StorageAdapter } from './types'

export interface GitHubConfig {
  token: string
  owner: string
  repo: string
  branch: string
}

// Base64 <-> UTF-8 that survives non-ASCII content.
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** A path ending in `.md` is stored as raw markdown text; everything else JSON. */
function isMarkdown(path: string): boolean {
  return path.endsWith('.md')
}

export class GitHubStorageAdapter implements StorageAdapter {
  private shaCache = new Map<string, string>()

  constructor(private cfg: GitHubConfig) {}

  private url(path: string): string {
    return `https://api.github.com/repos/${this.cfg.owner}/${this.cfg.repo}/contents/${encodeURI(path)}`
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
  }

  async read(path: string): Promise<Json | null> {
    const res = await fetch(`${this.url(path)}?ref=${encodeURIComponent(this.cfg.branch)}`, {
      headers: this.headers(),
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`GitHub read ${path}: ${res.status} ${res.statusText}`)
    const body = (await res.json()) as { content?: string; sha: string; encoding?: string }
    if (body.sha) this.shaCache.set(path, body.sha)
    if (body.content == null) return null
    const text = body.encoding === 'base64' ? base64ToUtf8(body.content) : body.content
    return isMarkdown(path) ? text : (JSON.parse(text) as Json)
  }

  private async resolveSha(path: string): Promise<string | undefined> {
    if (this.shaCache.has(path)) return this.shaCache.get(path)
    const res = await fetch(`${this.url(path)}?ref=${encodeURIComponent(this.cfg.branch)}`, {
      headers: this.headers(),
    })
    if (res.status === 404) return undefined
    if (!res.ok) throw new Error(`GitHub sha ${path}: ${res.status} ${res.statusText}`)
    const body = (await res.json()) as { sha: string }
    this.shaCache.set(path, body.sha)
    return body.sha
  }

  async write(path: string, data: Json): Promise<void> {
    const text = isMarkdown(path) ? String(data ?? '') : JSON.stringify(data, null, 2)
    const sha = await this.resolveSha(path)
    const res = await fetch(this.url(path), {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `masterboard: update ${path}`,
        content: utf8ToBase64(text),
        branch: this.cfg.branch,
        ...(sha ? { sha } : {}),
      }),
    })
    if (!res.ok) throw new Error(`GitHub write ${path}: ${res.status} ${res.statusText}`)
    const body = (await res.json()) as { content?: { sha: string } }
    if (body.content?.sha) this.shaCache.set(path, body.content.sha)
  }

  async remove(path: string): Promise<void> {
    const sha = await this.resolveSha(path)
    if (!sha) return // already gone
    const res = await fetch(this.url(path), {
      method: 'DELETE',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `masterboard: delete ${path}`, sha, branch: this.cfg.branch }),
    })
    if (!res.ok && res.status !== 404) {
      throw new Error(`GitHub delete ${path}: ${res.status} ${res.statusText}`)
    }
    this.shaCache.delete(path)
  }

  async list(prefix: string): Promise<string[]> {
    const res = await fetch(`${this.url(prefix)}?ref=${encodeURIComponent(this.cfg.branch)}`, {
      headers: this.headers(),
    })
    if (res.status === 404) return []
    if (!res.ok) throw new Error(`GitHub list ${prefix}: ${res.status} ${res.statusText}`)
    const body = (await res.json()) as Array<{ name: string }> | { name: string }
    return Array.isArray(body) ? body.map((e) => e.name) : []
  }

  /** Cheap connectivity/credential probe used by Settings. */
  async verify(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch(`https://api.github.com/repos/${this.cfg.owner}/${this.cfg.repo}`, {
        headers: this.headers(),
      })
      if (res.ok) return { ok: true, message: `Connected to ${this.cfg.owner}/${this.cfg.repo}` }
      if (res.status === 404) return { ok: false, message: 'Repo not found or token lacks access' }
      if (res.status === 401) return { ok: false, message: 'Bad token (401 Unauthorized)' }
      return { ok: false, message: `GitHub ${res.status} ${res.statusText}` }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Network error' }
    }
  }
}
