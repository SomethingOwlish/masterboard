// TaskAdapter that pushes a task into a third GitHub repo (B8). The GM's task
// "site" is one of their GitHub Pages repos; we append a record to a JSON file
// there via the Contents API (reusing the storage adapter) so the task shows up
// on that site, and hand back a URL to open it. Same fine-grained PAT as sync —
// it just needs Contents write on the task repo too.

import { newId } from '../model/ids'
import { GitHubStorageAdapter } from './github'
import type { TaskAdapter } from './types'

export interface TaskSiteConfig {
  token: string
  repo: string // "owner/repo"
  path: string // e.g. "data/tasks.json"
  branch?: string
}

/** Shape of each entry appended to the task site's JSON file. */
export interface ExternalTaskRecord {
  id: string
  title: string
  body?: string
  status: 'todo'
  createdAt: string
  source: 'masterboard'
}

export class GitHubTaskAdapter implements TaskAdapter {
  private storage: GitHubStorageAdapter
  private owner: string
  private repo: string
  private path: string
  private branch: string

  constructor(cfg: TaskSiteConfig) {
    const [owner, repo] = cfg.repo.split('/')
    if (!owner || !repo) throw new Error('Task site repo must be in "owner/repo" form.')
    this.owner = owner
    this.repo = repo
    this.path = cfg.path
    this.branch = cfg.branch || 'main'
    this.storage = new GitHubStorageAdapter({ token: cfg.token, owner, repo, branch: this.branch })
  }

  async create(task: { title: string; body?: string }): Promise<{ url: string; id?: string }> {
    const existing = (await this.storage.read(this.path)) as ExternalTaskRecord[] | null
    const list = Array.isArray(existing) ? existing : []
    const record: ExternalTaskRecord = {
      id: newId('xtask'),
      title: task.title,
      body: task.body,
      status: 'todo',
      createdAt: new Date().toISOString(),
      source: 'masterboard',
    }
    await this.storage.write(this.path, [...list, record])
    const url = `https://github.com/${this.owner}/${this.repo}/blob/${this.branch}/${this.path}`
    return { url, id: record.id }
  }
}
