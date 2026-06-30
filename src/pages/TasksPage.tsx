// Task tracker (M10 / B8). A todo/doing/done board over tasks.json, plus a push
// to the campaign's "third site" (a GitHub repo) per task. Tasks can link to any
// entity. The task-site coordinates (repo + path) live in campaign settings and
// are edited here; the GitHub token is shared with sync (Settings).

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Drawer } from '../components/Drawer'
import { makeTask } from '../model/defaults'
import { useNewAction } from '../lib/shortcuts'
import type { Task } from '../model/types'
import { useCampaign } from '../store/campaign'
import { KIND_ICON, useEntityPool } from '../store/entities'
import { useTasks } from '../store/tasks'
import { useConfirm } from '../components/useConfirm'
import { Icon, Button, TextField, Select, EmptyState, Tag } from '../ds'

const COLUMNS: { status: Task['status']; label: string }[] = [
  { status: 'todo', label: 'To do' },
  { status: 'doing', label: 'Doing' },
  { status: 'done', label: 'Done' },
]

export function TasksPage() {
  const { campaignId } = useParams()
  const tasks = useTasks((s) => s.tasks)
  const loading = useTasks((s) => s.loading)
  const load = useTasks((s) => s.load)
  const add = useTasks((s) => s.add)
  const update = useTasks((s) => s.update)
  const remove = useTasks((s) => s.remove)
  const pushExternal = useTasks((s) => s.pushExternal)

  const entities = useEntityPool(campaignId)
  const [openId, setOpenId] = useState<string | null>(null)
  const [pushMsg, setPushMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null)
  const confirm = useConfirm()

  useEffect(() => {
    if (campaignId) void load(campaignId)
  }, [campaignId, load])

  const editing = tasks.find((t) => t.id === openId) ?? null
  const byStatus = useMemo(
    () => Object.fromEntries(COLUMNS.map((c) => [c.status, tasks.filter((t) => t.status === c.status)])),
    [tasks],
  ) as Record<Task['status'], Task[]>

  async function create() {
    const t = makeTask()
    await add(t)
    setOpenId(t.id)
  }

  useNewAction(() => void create())

  async function push(id: string) {
    setPushMsg(null)
    try {
      const ref = await pushExternal(id)
      setPushMsg({ id, ok: true, text: `Pushed ↗ ${ref.url}` })
    } catch (e) {
      setPushMsg({ id, ok: false, text: e instanceof Error ? e.message : 'Push failed.' })
    }
  }

  const nameOf = (id: string) => entities.find((e) => e.id === id)

  return (
    <div className="content">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="row" style={{ margin: 0, gap: '0.5rem' }}>
          <Icon name="list-checks" size={24} /> Tasks
        </h1>
        <Button variant="primary" icon="plus" onClick={() => void create()}>New task</Button>
      </div>

      <TaskSiteConfig />

      {loading ? (
        <p className="muted" style={{ marginTop: '1rem' }}>Loading…</p>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon="list-checks"
          title="No tasks yet"
          hint="Add one with “New task”."
          action={<Button variant="primary" icon="plus" onClick={() => void create()}>New task</Button>}
          style={{ marginTop: '1rem' }}
        />
      ) : (
        <div className="tasks-board">
          {COLUMNS.map((col) => (
            <section key={col.status} className="tasks-col">
              <h2 className="tasks-col-title">
                {col.label} <span className="muted">{byStatus[col.status].length}</span>
              </h2>
              {byStatus[col.status].map((t) => (
                <button key={t.id} className="card task-card" onClick={() => setOpenId(t.id)}>
                  <strong>{t.title || '(untitled)'}</strong>
                  {t.body && <p className="muted entity-snippet">{t.body}</p>}
                  {t.links.length > 0 && (
                    <div className="chips">
                      {t.links.map((l) => {
                        const e = nameOf(l.toId)
                        return (
                          <Tag key={l.toId} icon={e ? KIND_ICON[e.kind] : undefined}>
                            {e ? e.name : 'linked'}
                          </Tag>
                        )
                      })}
                    </div>
                  )}
                  {t.externalRef && <span className="task-ext">↗ on site</span>}
                </button>
              ))}
            </section>
          ))}
        </div>
      )}

      {editing && (
        <Drawer
          title={editing.title || 'New task'}
          onClose={() => setOpenId(null)}
          footer={
            <>
              <Button
                variant="ghost"
                tone="danger"
                icon="trash-2"
                onClick={() =>
                  confirm({
                    title: 'Delete task?',
                    message: `Delete "${editing.title || 'this task'}"? This cannot be undone.`,
                    confirmLabel: 'Delete',
                    onConfirm: () => { void remove(editing.id); setOpenId(null) },
                  })
                }
              >
                Delete
              </Button>
              <Button variant="primary" onClick={() => setOpenId(null)}>Done</Button>
            </>
          }
        >
          <TextField
            label="Title"
            value={editing.title}
            onChange={(e) => void update(editing.id, { title: e.target.value })}
          />
          <TextField
            label="Details"
            multiline
            rows={3}
            value={editing.body ?? ''}
            onChange={(e) => void update(editing.id, { body: e.target.value || undefined })}
          />
          <Select
            label="Status"
            value={editing.status}
            onChange={(e) => void update(editing.id, { status: e.target.value as Task['status'] })}
          >
            {COLUMNS.map((c) => (
              <option key={c.status} value={c.status}>{c.label}</option>
            ))}
          </Select>

          <h3 className="section-title">Linked to</h3>
          <TaskLinks task={editing} onChange={(links) => void update(editing.id, { links })} />

          <h3 className="section-title" style={{ marginTop: '1rem' }}>Third site</h3>
          {editing.externalRef ? (
            <p className="muted" style={{ margin: '0 0 0.5rem' }}>
              Pushed ·{' '}
              <a href={editing.externalRef.url} target="_blank" rel="noreferrer noopener">open ↗</a>
            </p>
          ) : (
            <p className="muted" style={{ margin: '0 0 0.5rem' }}>Not pushed yet.</p>
          )}
          <Button icon="external-link" onClick={() => void push(editing.id)}>{editing.externalRef ? 'Push again' : 'Push to site'}</Button>
          {pushMsg?.id === editing.id && (
            <p style={{ margin: '0.5rem 0 0', color: pushMsg.ok ? 'var(--accent)' : 'crimson', wordBreak: 'break-all' }}>
              {pushMsg.text}
            </p>
          )}
        </Drawer>
      )}
    </div>
  )
}

/** The to-be-linked entity picker + current links for a task. */
function TaskLinks({ task, onChange }: { task: Task; onChange: (links: Task['links']) => void }) {
  const { campaignId } = useParams()
  const entities = useEntityPool(campaignId)
  const [pick, setPick] = useState('')

  const linked = task.links
  const available = entities.filter((e) => !linked.some((l) => l.toId === e.id))

  function add() {
    if (!pick) return
    const e = entities.find((x) => x.id === pick)
    if (!e) return
    onChange([...linked, { toId: e.id, kind: e.kind }])
    setPick('')
  }

  return (
    <div>
      {linked.length === 0 ? (
        <p className="muted" style={{ margin: '0 0 0.5rem' }}>Not linked to anything.</p>
      ) : (
        <div className="chips" style={{ marginBottom: '0.5rem' }}>
          {linked.map((l) => {
            const e = entities.find((x) => x.id === l.toId)
            return (
              <Tag
                key={l.toId}
                icon={e ? KIND_ICON[e.kind] : undefined}
                onRemove={() => onChange(linked.filter((x) => x.toId !== l.toId))}
              >
                {e ? e.name : '(unknown)'}
              </Tag>
            )
          })}
        </div>
      )}
      {available.length > 0 && (
        <div className="row" style={{ gap: '0.4rem' }}>
          <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1 }}>
            <option value="">Link to…</option>
            {available.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <button onClick={add} disabled={!pick}>Link</button>
        </div>
      )}
    </div>
  )
}

/** Editor for campaign.settings.taskSite (the third site's repo + JSON path). */
function TaskSiteConfig() {
  const taskSite = useCampaign((s) => s.campaign?.settings.taskSite ?? null)
  const updateSettings = useCampaign((s) => s.updateSettings)
  const [open, setOpen] = useState(false)
  const [repo, setRepo] = useState(taskSite?.repo ?? '')
  const [path, setPath] = useState(taskSite?.path ?? 'tasks.json')

  function save() {
    const r = repo.trim()
    const p = path.trim()
    void updateSettings({ taskSite: r && p ? { repo: r, path: p } : null })
    setOpen(false)
  }

  return (
    <section className="card" style={{ marginTop: '1rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section-title row" style={{ margin: 0, gap: '0.4rem' }}><Icon name="globe" size={18} /> Third site</h2>
        <button className="ghost" onClick={() => setOpen((v) => !v)}>{open ? 'Close' : taskSite ? 'Edit' : 'Set up'}</button>
      </div>
      {!open ? (
        <p className="muted" style={{ margin: '0.4rem 0 0' }}>
          {taskSite ? `Pushing tasks to ${taskSite.repo} · ${taskSite.path}` : 'Not configured. Set a repo to push tasks out.'}
        </p>
      ) : (
        <div style={{ marginTop: '0.5rem' }}>
          <div className="field">
            <label>Repo (owner/repo)</label>
            <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="your-handle/your-tasks-site" />
          </div>
          <div className="field">
            <label>File path</label>
            <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="tasks.json" />
          </div>
          <small className="muted">
            Tasks are appended to this JSON file via the GitHub token from Settings (needs Contents write on that repo).
          </small>
          <div className="row" style={{ marginTop: '0.5rem' }}>
            <button className="primary" onClick={save}>Save</button>
          </div>
        </div>
      )}
    </section>
  )
}
