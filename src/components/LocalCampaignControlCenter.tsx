import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Button, EmptyState, Icon } from '../ds'
import { newClock, newEntity, newSecret } from '../local/domain'
import { newTask, taskOriginLabel } from '../local/sessionFlow'
import type { LocalCampaignRecord, LocalCampaignTask, LocalInboxItem } from '../local/types'
import { ClocksPanel } from './local/ClocksPanel'
import { SecretsPanel } from './local/SecretsPanel'

type Props = { campaign: LocalCampaignRecord; persist: (next: LocalCampaignRecord) => void }
type Panel = 'clocks' | 'secrets' | 'tasks' | 'inbox'
const PANELS: Panel[] = ['clocks', 'secrets', 'tasks', 'inbox']
type InboxTarget = 'note' | 'task' | 'entity' | 'clock' | 'secret'

export function LocalCampaignControlCenter({ campaign, persist }: Props) {
  const [params] = useSearchParams()
  const asked = params.get('tab')
  const [panel, setPanel] = useState<Panel>(PANELS.includes(asked as Panel) ? asked as Panel : 'clocks')
  useEffect(() => { if (PANELS.includes(asked as Panel)) setPanel(asked as Panel) }, [asked])
  const [taskText, setTaskText] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [inboxText, setInboxText] = useState('')

  const saveTask = () => { if (!taskText.trim()) return; const tasks = editingTaskId ? campaign.tasks.map((item) => item.id === editingTaskId ? { ...item, text: taskText.trim() } : item) : [...campaign.tasks, newTask(taskText, 'masterboard')]; persist({ ...campaign, tasks }); setTaskText(''); setEditingTaskId(null) }
  const addInbox = () => { const raw = inboxText.trim(); if (!raw) return; const tags = [...raw.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((match) => match[1].toLocaleLowerCase()); const item: LocalInboxItem = { id: `inbox-${crypto.randomUUID()}`, text: raw.replace(/#[\p{L}\p{N}_-]+/gu, '').trim(), tags, createdAt: new Date().toISOString() }; persist({ ...campaign, inbox: [...campaign.inbox, item] }); setInboxText('') }
  const consumeInbox = (item: LocalInboxItem, target: InboxTarget) => {
    const rest = { ...campaign, inbox: campaign.inbox.filter((entry) => entry.id !== item.id) }
    if (target === 'note') persist({ ...rest, notes: [...campaign.notes, item.text] })
    if (target === 'task') persist({ ...rest, tasks: [...campaign.tasks, newTask(item.text, 'inbox')] })
    if (target === 'entity') persist({ ...rest, entities: [...campaign.entities, newEntity({ type: 'note', name: item.text, tags: item.tags, origin: { kind: 'inbox' } })] })
    if (target === 'clock') persist({ ...rest, clocks: [...campaign.clocks, newClock({ title: item.text })] })
    if (target === 'secret') persist({ ...rest, secrets: [...campaign.secrets, newSecret({ title: item.text, truth: item.text })] })
  }

  return <section className="campaign-section control-center"><header className="panel-heading"><div><span className="panel-kicker">Оперативный слой</span><h2>Пульт кампании</h2><p>Давление мира, закрытые знания и то, что мастеру нельзя потерять.</p></div></header><nav className="control-center__tabs" aria-label="Разделы пульта">{([['clocks', 'Часы', campaign.clocks.length], ['secrets', 'Секреты', campaign.secrets.length], ['tasks', 'Задачи', campaign.tasks.filter((item) => !item.done).length], ['inbox', 'Входящие', campaign.inbox.length]] as const).map(([id, label, count]) => <button key={id} className={panel === id ? 'active' : ''} onClick={() => setPanel(id)}>{label}<span>{count}</span></button>)}</nav>
    {panel === 'clocks' && <ClocksPanel campaign={campaign} persist={persist} />}
    {panel === 'secrets' && <SecretsPanel campaign={campaign} persist={persist} />}
    {panel === 'tasks' && <Tasks originOf={(task) => taskOriginLabel(task, campaign)} tasks={campaign.tasks} text={taskText} editing={Boolean(editingTaskId)} setText={setTaskText} save={saveTask} edit={(task) => { setEditingTaskId(task.id); setTaskText(task.text) }} cancel={() => { setEditingTaskId(null); setTaskText('') }} toggle={(id) => persist({ ...campaign, tasks: campaign.tasks.map((item) => item.id === id ? { ...item, done: !item.done } : item) })} remove={(id) => persist({ ...campaign, tasks: campaign.tasks.filter((item) => item.id !== id) })} />}
    {panel === 'inbox' && <Inbox items={campaign.inbox} text={inboxText} setText={setInboxText} add={addInbox} consume={consumeInbox} remove={(id) => persist({ ...campaign, inbox: campaign.inbox.filter((item) => item.id !== id) })} />}
  </section>
}

function Tasks({ originOf, tasks, text, editing, setText, save, edit, cancel, toggle, remove }: { originOf: (task: LocalCampaignTask) => string; tasks: LocalCampaignTask[]; text: string; editing: boolean; setText: (value: string) => void; save: () => void; edit: (task: LocalCampaignTask) => void; cancel: () => void; toggle: (id: string) => void; remove: (id: string) => void }) { return <div className="control-panel"><header><div><h3>Задачи ведущего</h3><p>Короткий список подготовки с видимым источником.</p></div></header><div className="control-capture"><input value={text} placeholder="Что нужно подготовить…" onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') save() }} />{editing && <Button onClick={cancel}>Отмена</Button>}<Button variant="primary" icon={editing ? 'check' : 'plus'} disabled={!text.trim()} onClick={save}>{editing ? 'Сохранить' : 'Добавить'}</Button></div>{tasks.length ? <ol className="task-list">{tasks.map((task) => <li key={task.id} className={task.done ? 'done' : ''}><button aria-label={task.done ? `Вернуть задачу: ${task.text}` : `Выполнить задачу: ${task.text}`} onClick={() => toggle(task.id)}><Icon name={task.done ? 'check' : 'circle'} size={18} /></button><div><span>{task.text}</span><small>{originOf(task)}</small></div><div className="task-list__actions"><Button size="sm" icon="pencil" aria-label={`Редактировать задачу: ${task.text}`} onClick={() => edit(task)} /><Button size="sm" tone="danger" icon="trash-2" aria-label={`Удалить задачу: ${task.text}`} onClick={() => remove(task.id)} /></div></li>)}</ol> : <EmptyState icon="list-checks" title="Открытых задач нет" hint="Добавьте короткое действие подготовки или превратите входящую запись в задачу." />}</div> }
function Inbox({ items, text, setText, add, consume, remove }: { items: LocalInboxItem[]; text: string; setText: (value: string) => void; add: () => void; consume: (item: LocalInboxItem, target: InboxTarget) => void; remove: (id: string) => void }) { return <div className="control-panel"><header><div><h3>Входящие</h3><p>Быстрый захват без обязательной типизации. Теги можно писать через #.</p></div></header><div className="control-capture"><input value={text} placeholder="Мысль, имя, последствие… #тег" onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') add() }} /><Button variant="primary" icon="plus" disabled={!text.trim()} onClick={add}>Зафиксировать</Button></div>{items.length ? <ol className="inbox-list">{items.map((item) => <li key={item.id}><div><p>{item.text}</p><footer>{item.tags.map((tag) => <Badge size="sm" key={tag}>#{tag}</Badge>)}<time>{new Date(item.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></footer></div><div><Button size="sm" onClick={() => consume(item, 'note')}>В заметку</Button><Button size="sm" onClick={() => consume(item, 'task')}>В задачу</Button><Button size="sm" onClick={() => consume(item, 'entity')}>В библиотеку</Button><Button size="sm" onClick={() => consume(item, 'clock')}>В часы</Button><Button size="sm" onClick={() => consume(item, 'secret')}>В секрет</Button><Button size="sm" tone="danger" icon="trash-2" aria-label={`Удалить входящую запись: ${item.text}`} onClick={() => remove(item.id)} /></div></li>)}</ol> : <EmptyState icon="scroll-text" title="Входящие разобраны" hint="Сюда можно быстро записать мысль, а тип определить позже." />}</div> }
