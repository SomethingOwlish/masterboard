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
  // One in-flight mutation per path. The Contents API is sha-versioned, so two
  // overlapping PUT/DELETEs to the same file race on a stale sha and 409. The
  // Session planner saves often, so chain writes per path to keep them ordered.
  private chains = new Map<string, Promise<unknown>>()

  constructor(private cfg: GitHubConfig) {}

  /** Run `op` after any pending mutation for `path` settles, serializing writes. */
  private serialize<T>(path: string, op: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(path) ?? Promise.resolve()
    const next = prev.then(op, op)
    // Keep the chain alive but never let a rejection poison the next link.
    this.chains.set(
      path,
      next.then(
        () => undefined,
        () => undefined,
      ),
    )
    return next
  }

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

  // GitHub error responses carry a human-readable `message` (e.g. "Resource not
  // accessible by personal access token", "Branch main not found"). Surface it so
  // sync failures are diagnosable instead of a bare status code.
  private async detail(res: Response): Promise<string> {
    try {
      const body = (await res.json()) as { message?: string }
      return body.message ? `${res.status} ${body.message}` : `${res.status} ${res.statusText}`
    } catch {
      return `${res.status} ${res.statusText}`
    }
  }

  async read(path: string): Promise<Json | null> {
    const res = await fetch(`${this.url(path)}?ref=${encodeURIComponent(this.cfg.branch)}`, {
      headers: this.headers(),
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Read ${path}: ${await this.detail(res)}`)
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
    if (!res.ok) throw new Error(`Sha ${path}: ${await this.detail(res)}`)
    const body = (await res.json()) as { sha: string }
    this.shaCache.set(path, body.sha)
    return body.sha
  }

  private putContents(path: string, text: string, sha: string | undefined): Promise<Response> {
    return fetch(this.url(path), {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `masterboard: update ${path}`,
        content: utf8ToBase64(text),
        branch: this.cfg.branch,
        ...(sha ? { sha } : {}),
      }),
    })
  }

  write(path: string, data: Json): Promise<void> {
    return this.serialize(path, async () => {
      const text = isMarkdown(path) ? String(data ?? '') : JSON.stringify(data, null, 2)
      let res = await this.putContents(path, text, await this.resolveSha(path))
      // 409/422 = the cached sha is stale (a prior write landed first). Refetch
      // the live sha and retry once — last-write-wins, never a stuck conflict.
      if (res.status === 409 || res.status === 422) {
        this.shaCache.delete(path)
        res = await this.putContents(path, text, await this.resolveSha(path))
      }
      if (!res.ok) throw new Error(`Write ${path}: ${await this.detail(res)}`)
      const body = (await res.json()) as { content?: { sha: string } }
      if (body.content?.sha) this.shaCache.set(path, body.content.sha)
    })
  }

  remove(path: string): Promise<void> {
    return this.serialize(path, async () => {
      const sha = await this.resolveSha(path)
      if (!sha) return // already gone
      const res = await fetch(this.url(path), {
        method: 'DELETE',
        headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `masterboard: delete ${path}`, sha, branch: this.cfg.branch }),
      })
      if (!res.ok && res.status !== 404) {
        throw new Error(`Delete ${path}: ${await this.detail(res)}`)
      }
      this.shaCache.delete(path)
    })
  }

  async list(prefix: string): Promise<string[]> {
    const res = await fetch(`${this.url(prefix)}?ref=${encodeURIComponent(this.cfg.branch)}`, {
      headers: this.headers(),
    })
    if (res.status === 404) return []
    if (!res.ok) throw new Error(`List ${prefix}: ${await this.detail(res)}`)
    const body = (await res.json()) as Array<{ name: string }> | { name: string }
    return Array.isArray(body) ? body.map((e) => e.name) : []
  }

  /** Connectivity/credential probe used by Settings. Also checks that the token
   *  can WRITE (the repo `permissions.push` flag) and that the target branch
   *  exists — the two things that otherwise only fail later, mid-sync. */
  async verify(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch(`https://api.github.com/repos/${this.cfg.owner}/${this.cfg.repo}`, {
        headers: this.headers(),
      })
      if (res.status === 404) return { ok: false, message: 'Repo not found, or the token has no access to it.' }
      if (res.status === 401) return { ok: false, message: 'Bad token (401 Unauthorized).' }
      if (!res.ok) return { ok: false, message: await this.detail(res) }

      const repo = (await res.json()) as { permissions?: { push?: boolean }; default_branch?: string }
      if (repo.permissions && repo.permissions.push === false) {
        return { ok: false, message: 'Token can read but not write. Set its Contents permission to "Read and write".' }
      }

      // Confirm the configured branch exists (empty repos have none yet).
      const branchRes = await fetch(
        `https://api.github.com/repos/${this.cfg.owner}/${this.cfg.repo}/branches/${encodeURIComponent(this.cfg.branch)}`,
        { headers: this.headers() },
      )
      if (branchRes.status === 404) {
        const hint = repo.default_branch && repo.default_branch !== this.cfg.branch
          ? ` The repo's default branch is "${repo.default_branch}".`
          : ' If the repo is empty, add a commit (e.g. a README) so the branch exists.'
        return { ok: false, message: `Branch "${this.cfg.branch}" not found.${hint}` }
      }

      return { ok: true, message: `Connected to ${this.cfg.owner}/${this.cfg.repo} — read/write OK.` }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Network error' }
    }
  }
}
