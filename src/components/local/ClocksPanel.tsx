import { PeekLink } from './Peek'
import type { PeekTarget } from '../../local/search'
import { useState } from 'react'
import { Badge, Button, EmptyState } from '../../ds'
import { moveClock, newClock, resolveClockTrigger } from '../../local/domain'
import { newTask } from '../../local/sessionFlow'
import type { LocalCampaignClock, LocalCampaignTask, LocalClockThreshold } from '../../local/types'
import { useConfirm } from '../useConfirm'
import { Checklist, Editor, type SectionProps } from './shared'

type PeekChip = { label: string; target: PeekTarget }

const CLOCK_KIND: Record<LocalCampaignClock['kind'], string> = { threat: 'Угроза', goal: 'Цель', project: 'Проект', world: 'Мир' }
type Draft = Omit<LocalCampaignClock, 'id' | 'history' | 'triggerStatus' | 'firedAt'>
type ClockEvent = { clockId: string; reached: LocalClockThreshold[]; filled: boolean }

/** Full and not yet decided: deferred, or the dialog was closed without a choice. */
const awaitsDecision = (clock: LocalCampaignClock) => clock.triggerStatus === 'deferred' || (clock.triggerStatus === 'idle' && clock.value >= clock.segments)

const consequenceTask = (clock: LocalCampaignClock, text: string): LocalCampaignTask => newTask(`Последствие часов «${clock.title}»: ${text}`, 'clock', { clockId: clock.id })

export function ClocksPanel({ campaign, persist }: SectionProps) {
  const confirm = useConfirm()
  const [editor, setEditor] = useState<LocalCampaignClock | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(() => { const { id: _i, history: _h, triggerStatus: _t, firedAt: _f, ...rest } = newClock(); return rest })
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [event, setEvent] = useState<ClockEvent | null>(null)
  const [addTasks, setAddTasks] = useState(true)

  const openEditor = (clock: LocalCampaignClock | 'new') => { setEditor(clock); const { id: _i, history: _h, triggerStatus: _t, firedAt: _f, ...rest } = clock === 'new' ? newClock() : clock; setDraft(rest) }
  const save = () => {
    if (!draft.title.trim() || !editor) return
    const existing = editor === 'new' ? newClock() : editor
    const segments = draft.segments
    const clock: LocalCampaignClock = { ...existing, ...draft, title: draft.title.trim(), trigger: draft.trigger.trim(), advanceCondition: draft.advanceCondition.trim(), rollbackCondition: draft.rollbackCondition.trim(), value: Math.min(draft.value, segments), thresholds: draft.thresholds.filter((item) => item.consequence.trim() && item.at > 0 && item.at < segments).sort((a, b) => a.at - b.at) }
    persist({ ...campaign, clocks: editor === 'new' ? [...campaign.clocks, clock] : campaign.clocks.map((item) => item.id === clock.id ? clock : item) })
    setEditor(null)
  }
  const move = (clock: LocalCampaignClock, delta: number) => {
    const result = moveClock(clock, delta, reasons[clock.id] ?? '', new Date().toISOString())
    if (!result) return
    persist({ ...campaign, clocks: campaign.clocks.map((item) => item.id === clock.id ? result.clock : item) })
    setReasons({ ...reasons, [clock.id]: '' })
    if (result.reached.length || result.filled) { setAddTasks(true); setEvent({ clockId: clock.id, reached: result.reached, filled: result.filled }) }
  }
  const finishEvent = (decision: 'fired' | 'deferred' | 'ack') => {
    if (!event) return
    const clock = campaign.clocks.find((item) => item.id === event.clockId)
    if (!clock) { setEvent(null); return }
    const next = decision === 'ack' ? clock : resolveClockTrigger(clock, decision, new Date().toISOString())
    const texts = addTasks ? [...event.reached.map((item) => item.consequence), ...(decision === 'fired' && clock.trigger ? [clock.trigger] : [])] : []
    persist({ ...campaign, clocks: campaign.clocks.map((item) => item.id === clock.id ? next : item), tasks: [...campaign.tasks, ...texts.map((text) => consequenceTask(clock, text))] })
    setEvent(null)
  }
  const remove = (clock: LocalCampaignClock) => confirm({ title: 'Удалить часы?', message: 'История изменений этих часов тоже будет удалена.', confirmLabel: 'Удалить', cancelLabel: 'Отмена', onConfirm: () => persist({ ...campaign, clocks: campaign.clocks.filter((item) => item.id !== clock.id), secrets: campaign.secrets.map((secret) => ({ ...secret, clockIds: secret.clockIds.filter((id) => id !== clock.id) })) }) })
  const arcTitle = (id: string) => campaign.storyArcs.find((arc) => arc.id === id)?.title
  /** Thresholds the chosen number of segments no longer fits; saving drops them. */
  const lost = draft.thresholds.filter((item) => item.consequence.trim() && item.at >= draft.segments)
  const eventClock = event ? campaign.clocks.find((item) => item.id === event.clockId) : undefined

  return <div className="control-panel"><header><div><h3>Часы и угрозы</h3><p>Каждое движение сохраняет причину. Отметки и заполнение требуют подтверждения мастера.</p></div><Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Новые часы</Button></header>
    {campaign.clocks.length ? <div className="clock-grid">{campaign.clocks.map((clock) => { const reason = reasons[clock.id] ?? ''; const links: PeekChip[] = [...(arcTitle(clock.arcId) ? [{ label: `Линия: ${arcTitle(clock.arcId)}`, target: { kind: 'arc' as const, id: clock.arcId } }] : []), ...clock.entityIds.flatMap((id) => { const name = campaign.entities.find((entity) => entity.id === id)?.name; return name ? [{ label: name, target: { kind: 'entity' as const, id } }] : [] }), ...clock.secretIds.flatMap((id) => { const title = campaign.secrets.find((secret) => secret.id === id)?.title; return title ? [{ label: `Секрет: ${title}`, target: { kind: 'secret' as const, id } }] : [] })]; return <article key={clock.id} className={clock.value === clock.segments ? 'filled' : ''} aria-label={`Часы: ${clock.title}`}>
      <header><div><Badge tone={clock.kind === 'threat' ? 'warning' : 'neutral'}>{CLOCK_KIND[clock.kind]}</Badge><Badge tone={clock.visibility === 'public' ? 'success' : 'neutral'}>{clock.visibility === 'public' ? 'Для игроков' : 'Мастерское'}</Badge>{clock.triggerStatus === 'fired' && <Badge tone="danger">Сработали</Badge>}{clock.triggerStatus === 'deferred' && <Badge tone="warning">Ждут подтверждения</Badge>}</div><Button size="sm" icon="pencil" aria-label={`Редактировать часы: ${clock.title}`} onClick={() => openEditor(clock)} /></header>
      <h4>{clock.title}</h4>
      <div className="clock-track" aria-label={`${clock.value} из ${clock.segments}`}>{Array.from({ length: clock.segments }, (_, index) => <i key={index} className={[index < clock.value ? 'active' : '', clock.thresholds.some((item) => item.at === index + 1) ? 'threshold' : ''].join(' ').trim()} />)}</div>
      <strong>{clock.value} / {clock.segments}</strong>
      <p>{clock.trigger || 'Событие при заполнении не задано.'}</p>
      {(clock.advanceCondition || clock.rollbackCondition) && <dl className="clock-conditions">{clock.advanceCondition && <div><dt>Растут, когда</dt><dd>{clock.advanceCondition}</dd></div>}{clock.rollbackCondition && <div><dt>Откатываются, когда</dt><dd>{clock.rollbackCondition}</dd></div>}</dl>}
      {clock.thresholds.length > 0 && <ul className="clock-thresholds">{clock.thresholds.map((item) => <li key={item.id} className={item.reachedAt ? 'reached' : ''}><strong>{item.at}</strong> {item.consequence}</li>)}</ul>}
      {links.length > 0 && <div className="local-chips">{links.map((link) => <PeekLink key={link.label} className="local-chip" target={link.target}>{link.label}</PeekLink>)}</div>}
      {awaitsDecision(clock) && <Button size="sm" variant="primary" onClick={() => { setAddTasks(true); setEvent({ clockId: clock.id, reached: [], filled: true }) }}>Подтвердить срабатывание</Button>}
      <input className="clock-reason" aria-label={`Причина движения: ${clock.title}`} value={reason} placeholder="Причина движения часов…" onChange={(e) => setReasons({ ...reasons, [clock.id]: e.target.value })} />
      <footer><Button size="sm" disabled={!clock.value || !reason.trim()} onClick={() => move(clock, -1)}>− Откатить</Button><Button size="sm" variant="primary" disabled={clock.value === clock.segments || !reason.trim()} onClick={() => move(clock, 1)}>+ Продвинуть</Button><Button size="sm" tone="danger" icon="trash-2" aria-label={`Удалить часы: ${clock.title}`} onClick={() => remove(clock)} /></footer>
      {clock.history.length > 0 && <details className="clock-history"><summary>История · {clock.history.length}</summary><ol>{[...clock.history].reverse().map((entry) => <li key={entry.id}><strong>{entry.delta > 0 ? `+${entry.delta}` : entry.delta || '✓'}</strong><span>{entry.reason}{entry.note ? ` — ${entry.note}` : ''}</span><time>{new Date(entry.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></li>)}</ol></details>}
    </article> })}</div> : <EmptyState icon="history" title="Часы ещё не заведены" hint="Создайте угрозу, проект или прогресс цели и двигайте его осознанными шагами." action={<Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Создать часы</Button>} />}

    {event && eventClock && <Editor title={event.filled ? `Часы заполнены: ${eventClock.title}` : `Отметка часов: ${eventClock.title}`} close={() => setEvent(null)}>
      {event.reached.length > 0 && <><p>Пройдены отметки:</p><ul className="clock-thresholds">{event.reached.map((item) => <li key={item.id} className="reached"><strong>{item.at}</strong> {item.consequence}</li>)}</ul></>}
      {event.filled && <div className="clock-event__trigger"><span className="panel-kicker">Событие при заполнении</span><p>{eventClock.trigger || 'Событие не описано.'}</p></div>}
      <label className="local-checkbox"><input type="checkbox" checked={addTasks} onChange={(e) => setAddTasks(e.target.checked)} /> Добавить последствия в задачи ведущего</label>
      <footer>{event.filled ? <><Button onClick={() => finishEvent('deferred')}>Отложить</Button><Button variant="primary" icon="check" onClick={() => finishEvent('fired')}>Сработало</Button></> : <Button variant="primary" icon="check" onClick={() => finishEvent('ack')}>Понятно</Button>}</footer>
    </Editor>}

    {editor && <Editor title={editor === 'new' ? 'Новые часы' : 'Редактировать часы'} close={() => setEditor(null)} draft={draft}>
      <label htmlFor="clock-title">Название<input id="clock-title" autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
      <div className="control-form__row"><label htmlFor="clock-kind">Тип<select id="clock-kind" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as LocalCampaignClock['kind'] })}><option value="threat">Угроза</option><option value="goal">Прогресс цели</option><option value="project">Проект</option><option value="world">Состояние мира</option></select></label><label htmlFor="clock-segments">Сегментов<select id="clock-segments" value={draft.segments} onChange={(e) => setDraft({ ...draft, segments: Number(e.target.value), value: Math.min(draft.value, Number(e.target.value)) })}>{[4, 6, 8, 10, 12].map((count) => <option key={count}>{count}</option>)}</select></label><label htmlFor="clock-visibility">Видимость<select id="clock-visibility" value={draft.visibility} onChange={(e) => setDraft({ ...draft, visibility: e.target.value as LocalCampaignClock['visibility'] })}><option value="master">Только мастерам</option><option value="public">Можно показать игрокам</option></select></label></div>
      <label htmlFor="clock-trigger">Событие при заполнении<textarea id="clock-trigger" rows={2} value={draft.trigger} onChange={(e) => setDraft({ ...draft, trigger: e.target.value })} /></label>
      <div className="control-form__row"><label htmlFor="clock-advance">Когда продвигать<input id="clock-advance" value={draft.advanceCondition} placeholder="Каждая ночь без нового договора" onChange={(e) => setDraft({ ...draft, advanceCondition: e.target.value })} /></label><label htmlFor="clock-rollback">Когда откатывать<input id="clock-rollback" value={draft.rollbackCondition} placeholder="Герои задобрили луну" onChange={(e) => setDraft({ ...draft, rollbackCondition: e.target.value })} /></label></div>
      <fieldset className="local-checklist clock-thresholds-editor"><legend>Промежуточные отметки</legend>{draft.thresholds.map((item, index) => <div key={item.id} className="row"><select aria-label={`Сегмент отметки ${index + 1}`} value={item.at} onChange={(e) => setDraft({ ...draft, thresholds: draft.thresholds.map((current) => current.id === item.id ? { ...current, at: Number(e.target.value) } : current) })}>{item.at >= draft.segments && <option value={item.at} disabled>{item.at} — за шкалой</option>}{Array.from({ length: draft.segments - 1 }, (_, at) => <option key={at + 1} value={at + 1}>{at + 1}</option>)}</select><input aria-label={`Последствие отметки ${index + 1}`} value={item.consequence} placeholder="Что происходит на этой отметке" onChange={(e) => setDraft({ ...draft, thresholds: draft.thresholds.map((current) => current.id === item.id ? { ...current, consequence: e.target.value } : current) })} /><Button size="sm" tone="danger" icon="trash-2" aria-label={`Убрать отметку ${index + 1}`} onClick={() => setDraft({ ...draft, thresholds: draft.thresholds.filter((current) => current.id !== item.id) })} /></div>)}{lost.map((item) => (
        <p key={item.id} className="local-session-error">
          Отметка {item.at} будет удалена: в часах {draft.segments} сегментов.
        </p>
      ))}<Button size="sm" icon="plus" onClick={() => setDraft({ ...draft, thresholds: [...draft.thresholds, { id: `threshold-${crypto.randomUUID()}`, at: Math.max(1, Math.floor(draft.segments / 2)), consequence: '' }] })}>Добавить отметку</Button></fieldset>
      <label htmlFor="clock-arc">Сюжетная линия<select id="clock-arc" value={draft.arcId} onChange={(e) => setDraft({ ...draft, arcId: e.target.value })}><option value="">Без линии</option>{campaign.storyArcs.map((arc) => <option key={arc.id} value={arc.id}>{arc.title}</option>)}</select></label>
      <Checklist legend="Связанные сущности" options={campaign.entities.filter((entity) => entity.status !== 'archived').map((entity) => ({ id: entity.id, label: entity.name }))} value={draft.entityIds} onChange={(entityIds) => setDraft({ ...draft, entityIds })} empty="Библиотека пуста." />
      <Checklist legend="Связанные секреты" options={campaign.secrets.map((secret) => ({ id: secret.id, label: secret.title }))} value={draft.secretIds} onChange={(secretIds) => setDraft({ ...draft, secretIds })} empty="Секретов пока нет." />
      <footer><Button onClick={() => setEditor(null)}>Отмена</Button><Button variant="primary" icon="check" disabled={!draft.title.trim()} onClick={save}>Сохранить</Button></footer>
    </Editor>}
  </div>
}
