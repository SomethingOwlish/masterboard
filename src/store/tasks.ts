// Task tracker store (M10 / B8). tasks.json is the local mirror; each task can be
// pushed to the campaign's configured "third site" (a GitHub repo) via the
// GitHubTaskAdapter, which stores an externalRef back-link. Mirrors the locations
// store pattern, plus the external push.

import { create } from 'zustand'
import { GitHubTaskAdapter } from '../adapters/githubTasks'
import type { Task } from '../model/types'
import { data } from '../storage/data'
import { useActivity } from './activity'
import { useCampaign } from './campaign'
import { useConfig } from './config'

interface TasksState {
  campaignId: string | null
  tasks: Task[]
  loading: boolean

  load: (campaignId: string) => Promise<void>
  add: (task: Task) => Promise<void>
  update: (id: string, patch: Partial<Task>) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Push a task to the configured third site; records its externalRef on success. */
  pushExternal: (id: string) => Promise<{ url: string; id?: string }>
}

export const useTasks = create<TasksState>((set, get) => ({
  campaignId: null,
  tasks: [],
  loading: false,

  load: async (campaignId) => {
    if (get().campaignId === campaignId && !get().loading) return
    set({ loading: true, campaignId, tasks: [] })
    const tasks = await data.readModuleArray<Task>(campaignId, 'tasks')
    if (get().campaignId === campaignId) set({ tasks, loading: false })
  },

  add: async (task) => {
    const { campaignId, tasks } = get()
    if (!campaignId) return
    const next = [...tasks, task]
    set({ tasks: next })
    await data.writeModuleArray(campaignId, 'tasks', next)
    void useActivity.getState().log(campaignId, 'Added task', task.title || '(untitled)')
  },

  update: async (id, patch) => {
    const { campaignId, tasks } = get()
    if (!campaignId) return
    const next = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t))
    set({ tasks: next })
    await data.writeModuleArray(campaignId, 'tasks', next)
  },

  remove: async (id) => {
    const { campaignId, tasks } = get()
    if (!campaignId) return
    const target = tasks.find((t) => t.id === id)
    const next = tasks.filter((t) => t.id !== id)
    set({ tasks: next })
    await data.writeModuleArray(campaignId, 'tasks', next)
    if (target) void useActivity.getState().log(campaignId, 'Deleted task', target.title || '(untitled)')
  },

  pushExternal: async (id) => {
    const { campaignId, tasks } = get()
    if (!campaignId) throw new Error('No campaign open.')
    const task = tasks.find((t) => t.id === id)
    if (!task) throw new Error('Task not found.')

    const taskSite = useCampaign.getState().campaign?.settings.taskSite
    if (!taskSite || !taskSite.repo || !taskSite.path) {
      throw new Error('Set the task site (repo + path) in this section first.')
    }
    const token = useConfig.getState().token
    if (!token) throw new Error('Connect a GitHub token in Settings to push tasks.')

    const adapter = new GitHubTaskAdapter({ token, repo: taskSite.repo, path: taskSite.path })
    const ref = await adapter.create({ title: task.title, body: task.body })
    await get().update(id, { externalRef: ref })
    void useActivity.getState().log(campaignId, 'Pushed task to site', task.title || '(untitled)')
    return ref
  },
}))
