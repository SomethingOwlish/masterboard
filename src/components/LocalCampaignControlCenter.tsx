import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, EmptyState, Icon, Tabs, TextField } from '../ds'
import { newTask, taskOriginLabel } from '../local/sessionFlow'
import type { LocalCampaignRecord, LocalCampaignTask } from '../local/types'
import { ClocksPanel } from './local/ClocksPanel'
import { SecretsPanel } from './local/SecretsPanel'
import { removeWithUndo } from './toast'
import { InboxList } from './local/InboxList'

type Props = { campaign: LocalCampaignRecord; persist: (next: LocalCampaignRecord) => void }
type Panel = 'clocks' | 'secrets' | 'tasks' | 'inbox'
const PANELS: Panel[] = ['clocks', 'secrets', 'tasks', 'inbox']

export function LocalCampaignControlCenter({ campaign, persist }: Props) {
  const [params] = useSearchParams()
  const asked = params.get('tab')
  const [panel, setPanel] = useState<Panel>(PANELS.includes(asked as Panel) ? asked as Panel : 'clocks')
  useEffect(() => { if (PANELS.includes(asked as Panel)) setPanel(asked as Panel) }, [asked])
  const [taskText, setTaskText] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  const saveTask = () => { if (!taskText.trim()) return; const tasks = editingTaskId ? campaign.tasks.map((item) => item.id === editingTaskId ? { ...item, text: taskText.trim() } : item) : [...campaign.tasks, newTask(taskText, 'masterboard')]; persist({ ...campaign, tasks }); setTaskText(''); setEditingTaskId(null) }
  const removeTask = (id: string) => removeWithUndo(persist, campaign, { ...campaign, tasks: campaign.tasks.filter((item) => item.id !== id) }, `Задача «${campaign.tasks.find((item) => item.id === id)?.text ?? ''}»`)

  return <section className="campaign-section control-center"><header className="panel-heading"><div><span className="panel-kicker">Оперативный слой</span><h2>Пульт кампании</h2><p>Давление мира, закрытые знания и то, что мастеру нельзя потерять.</p></div></header>
    <Tabs
      className="campaign-tabs"
      aria-label="Разделы пульта"
      idPrefix="control-tab"
      activeId={panel}
      onSelect={(id) => setPanel(id as Panel)}
      tabs={[
        { id: 'clocks', label: 'Часы', count: campaign.clocks.length },
        { id: 'secrets', label: 'Секреты', count: campaign.secrets.length },
        { id: 'tasks', label: 'Задачи', count: campaign.tasks.filter((item) => !item.done).length },
        { id: 'inbox', label: 'Входящие', count: campaign.inbox.length },
      ]}
    />

    {panel === 'clocks' && <ClocksPanel campaign={campaign} persist={persist} />}
    {panel === 'secrets' && <SecretsPanel campaign={campaign} persist={persist} />}
    {panel === 'tasks' && <Tasks originOf={(task) => taskOriginLabel(task, campaign)} tasks={campaign.tasks} text={taskText} editing={Boolean(editingTaskId)} setText={setTaskText} save={saveTask} edit={(task) => { setEditingTaskId(task.id); setTaskText(task.text) }} cancel={() => { setEditingTaskId(null); setTaskText('') }} toggle={(id) => persist({ ...campaign, tasks: campaign.tasks.map((item) => item.id === id ? { ...item, done: !item.done } : item) })} remove={removeTask} />}
    {panel === 'inbox' && <div className="control-panel">
      <header><div><h3>Входящие</h3><p>Быстрый захват без обязательной типизации. Теги можно писать через #.</p></div></header>
      <InboxList campaign={campaign} persist={persist} />
    </div>}
  </section>
}

function Tasks({ originOf, tasks, text, editing, setText, save, edit, cancel, toggle, remove }: { originOf: (task: LocalCampaignTask) => string; tasks: LocalCampaignTask[]; text: string; editing: boolean; setText: (value: string) => void; save: () => void; edit: (task: LocalCampaignTask) => void; cancel: () => void; toggle: (id: string) => void; remove: (id: string) => void }) { return <div className="control-panel"><header><div><h3>Задачи</h3><p>Короткий список подготовки с видимым источником.</p></div></header><div className="control-capture">
      <TextField
        value={text}
        placeholder="Что нужно подготовить…"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') save() }}
      />
      {editing
 && <Button onClick={cancel}>Отмена</Button>}<Button variant="primary" icon={editing ? 'check' : 'plus'} disabled={!text.trim()} onClick={save}>{editing ? 'Сохранить' : 'Добавить'}</Button></div>{tasks.length ? <ol className="task-list">{tasks.map((task) => <li key={task.id} className={task.done ? 'done' : ''}><button aria-label={task.done ? `Вернуть задачу: ${task.text}` : `Выполнить задачу: ${task.text}`} onClick={() => toggle(task.id)}><Icon name={task.done ? 'check' : 'circle'} size={18} /></button><div><span>{task.text}</span><small>{originOf(task)}</small></div><div className="task-list__actions"><Button size="sm" icon="pencil" aria-label={`Редактировать задачу: ${task.text}`} onClick={() => edit(task)} /><Button size="sm" tone="danger" icon="trash-2" aria-label={`Удалить задачу: ${task.text}`} onClick={() => remove(task.id)} /></div></li>)}</ol> : <EmptyState icon="list-checks" title="Открытых задач нет" hint="Добавьте короткое действие подготовки или превратите входящую запись в задачу." />}</div> }
