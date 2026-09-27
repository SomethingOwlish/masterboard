import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Icon } from '../../ds'
import { downloadText } from '../../local/download'
import { mastersLabel } from '../../local/team'
import { useActing } from '../../local/actingContext'
import { layoutFor, moveWidget, toggleHidden, toggleWide, WIDGET_LABEL, withLayout } from '../../local/personal'
import type { LocalDashboardLayout, LocalWidgetId } from '../../local/types'
import { useLocalCatalog } from '../../local/useLocalCampaign'
import { Editor, type SectionProps } from './shared'
import { liveSessions } from '../../local/sessions'
import { SECRET_STATUS, sessionStatusText } from '../../local/labels'
import { PeekLink } from './Peek'
import { ROLE_LABEL, SYSTEM_LABEL, linkedRole } from '../../local/integration'
import { consumeInbox, newInboxItem, type InboxTarget } from '../../local/inbox'
import type { LocalCampaignEntityType, LocalInboxItem } from '../../local/types'
import { ENTITY_TYPES } from './shared'

export function OverviewSection({ campaign, persist }: SectionProps) {
  const navigate = useNavigate()
  const catalog = useLocalCatalog()
  const [capture, setCapture] = useState('')
  const [editing, setEditing] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const acting = useActing(campaign)
  const [details, setDetails] = useState({ name: '', idea: '', activeTime: '' })
  const go = (section: string) => navigate(`/local/campaign/${campaign.id}/${section}`)
  const sessions = liveSessions(campaign)
  const currentSession = sessions.find((session) => session.id === campaign.activeSessionId) ?? sessions.find((session) => session.status === 'active') ?? sessions.at(-1)
  const currentStatus = currentSession?.status ?? 'draft'
  const sessionStatus = currentSession ? sessionStatusText(currentSession) : 'Черновик'
  const reviewed = currentStatus === 'completed' && currentSession?.reviewStatus === 'completed'
  const nextPath = currentStatus === 'completed' && !reviewed ? 'review' : currentStatus === 'active' ? 'play' : 'session'
  const nextLabel = nextPath === 'review' ? 'Разобрать сессию' : nextPath === 'play' ? 'Открыть игровой стол' : 'Открыть сессию'
  const activeArcs = campaign.storyArcs.filter((arc) => arc.status === 'active')
  const toggleTask = (id: string) => persist({ ...campaign, tasks: campaign.tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task) })
  const addCapture = () => { const text = capture.trim(); if (!text) return; persist({ ...campaign, inbox: [...campaign.inbox, newInboxItem(text, new Date().toISOString())] }); setCapture('') }
  const openEditor = () => { setDetails({ name: campaign.name, idea: campaign.idea, activeTime: campaign.activeTime }); setEditing(true) }
  const saveCampaign = () => { if (!details.name.trim()) return; persist({ ...campaign, name: details.name.trim(), idea: details.idea.trim(), activeTime: details.activeTime.trim() || 'Время ещё не задано' }); setEditing(false) }
  const exportCampaign = async () => downloadText(`${campaign.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.masterboard.json`, await catalog.exportCampaign(campaign.id))

  const widgets: Record<LocalWidgetId, JSX.Element> = {
    session: <section className="target-dashboard__session"><div><span className="panel-kicker">Текущая сессия · {sessionStatus}</span><h2>{currentSession?.title ?? 'Сессия не выбрана'}</h2><p>{currentSession?.focus || 'Добавьте цель, вопрос или тему сессии, чтобы зафиксировать ожидаемый результат игры.'}</p></div><div className="target-dashboard__session-action"><Badge tone={reviewed ? 'neutral' : 'warning'} dot>{sessionStatus}</Badge><Button variant="primary" icon="clapperboard" onClick={() => go(nextPath)}>{nextLabel}</Button></div></section>,
    arcs: <Card className="target-panel"><div className="panel-heading"><div><span className="panel-kicker">Движение кампании</span><h2 className="section-title">Активные линии</h2></div><Button onClick={() => go('arcs')}>{activeArcs.length} в игре</Button></div><div className="target-lines">{activeArcs.length ? activeArcs.map((arc) => <article key={arc.id}><div><Badge tone="accent" size="sm">В игре · {arc.progress}%</Badge><h3><PeekLink target={{ kind: 'arc', id: arc.id }}>{arc.title}</PeekLink></h3><p>{arc.direction || 'Направление пока не задано.'}</p></div><strong>{arc.stakes || 'Ставки не определены'}</strong></article>) : <button className="local-dashboard-empty" onClick={() => go('arcs')}><Icon name="plus" size={18} /> Добавить первую активную линию</button>}</div></Card>,
    clocks: <Card className="target-panel"><div className="panel-heading"><div><span className="panel-kicker">Давление</span><h2 className="section-title">Часы</h2></div><Button size="sm" onClick={() => go('control')}>Все</Button></div>{campaign.clocks.length ? campaign.clocks.slice(0, 3).map((clock) => <div className="target-clock" key={clock.id}><div className="row"><strong><PeekLink target={{ kind: 'clock', id: clock.id }}>{clock.title}</PeekLink></strong><span className="mb-data">{clock.value}/{clock.segments}</span></div><div className="target-clock__track"><span style={{ width: `${(clock.value / clock.segments) * 100}%` }} /></div><small>{clock.visibility === 'public' ? 'Можно показать игрокам' : 'Только ведущим'}</small></div>) : <button className="local-dashboard-empty" onClick={() => go('control')}><Icon name="plus" size={18} /> Создать часы</button>}</Card>,
    secrets: <Card className="target-panel"><div className="panel-heading"><div><span className="panel-kicker">Знание</span><h2 className="section-title">Секреты</h2></div><span className="panel-state">{SECRET_STATUS.hidden}: {campaign.secrets.filter((secret) => secret.status === 'hidden').length}</span></div>{campaign.secrets.length ? campaign.secrets.slice(0, 2).map((secret) => <article className="target-secret" key={secret.id}><Badge tone={secret.status === 'hidden' ? 'warning' : 'neutral'} icon="shield" size="sm">{SECRET_STATUS[secret.status]}</Badge><h3><PeekLink target={{ kind: 'secret', id: secret.id }}>{secret.title}</PeekLink></h3><p>{secret.truth}</p><small>{secret.publicVersion ? `Для игроков: ${secret.publicVersion}` : 'Публичная версия не подготовлена'}</small></article>) : <button className="local-dashboard-empty" onClick={() => go('control')}><Icon name="plus" size={18} /> Добавить секрет</button>}</Card>,
    tasks: <Card className="target-panel"><div className="panel-heading"><div><span className="panel-kicker">Личное</span><h2 className="section-title">Список ведущего</h2></div><span className="panel-state">{campaign.tasks.filter((task) => !task.done).length} открыто</span></div>{campaign.tasks.length ? <ul className="target-checklist">{campaign.tasks.slice(0, 5).map((task) => <li key={task.id}><input id={`overview-${task.id}`} type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} /><label htmlFor={`overview-${task.id}`}>{task.text}</label><Badge tone={task.done ? 'neutral' : 'accent'} size="sm">{task.done ? 'готово' : task.source === 'inbox' ? 'входящие' : 'дело'}</Badge></li>)}</ul> : <button className="local-dashboard-empty" onClick={() => go('control')}><Icon name="plus" size={18} /> Добавить задачу</button>}</Card>,
    inbox: <Card className="target-panel"><div className="panel-heading"><div><span className="panel-kicker">Быстрая запись</span><h2 className="section-title">Входящие</h2></div><span className="panel-state">{campaign.inbox.length}</span></div><div className="target-capture"><input aria-label="Быстрая запись" value={capture} placeholder="Запишите идею, не разбирая её…" onChange={(event) => setCapture(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addCapture() }} /><Button variant="primary" icon="plus" disabled={!capture.trim()} onClick={addCapture}>Записать</Button></div>{campaign.inbox.length > 0 && <ol className="target-inbox target-inbox--triage" aria-label="Разобрать входящие">{campaign.inbox.slice(-6).reverse().map((item) => <InboxRow key={item.id} item={item} consume={(target, type) => persist(consumeInbox(campaign, item, target, type))} remove={() => persist({ ...campaign, inbox: campaign.inbox.filter((entry) => entry.id !== item.id) })} />)}</ol>}{campaign.inbox.length > 6 && <Button size="sm" onClick={() => go('control?tab=inbox')}>Все входящие · {campaign.inbox.length}</Button>}</Card>,
  }
  const layout = layoutFor(campaign, acting.master.id)
  const visible = layout.order.filter((id) => !layout.hidden.includes(id))
  const shared = Boolean(catalog.shared?.isShared(campaign.id))
  const links = (['world', 'table', 'system'] as const).flatMap((role) => { const linked = linkedRole(campaign, role); return linked ? [`${ROLE_LABEL[role].toLocaleLowerCase()} — ${SYSTEM_LABEL[linked.system]} «${linked.link.label}»`] : [] })
  const saveLayout = (next: LocalDashboardLayout) => persist(withLayout(campaign, acting.master.id, next))

  return <>
    <section className="target-dashboard__hero"><div><span className="panel-kicker">Панель кампании</span><h1>{campaign.name}</h1><p>{campaign.idea}</p></div><div className="target-dashboard__hero-actions"><div className="row"><Button icon="pencil" onClick={openEditor}>Редактировать</Button><Button icon="download" onClick={() => void exportCampaign()}>Экспорт</Button><Button icon="layout-dashboard" aria-pressed={customizing} onClick={() => setCustomizing(!customizing)}>{customizing ? 'Готово' : 'Настроить обзор'}</Button></div><div className="target-dashboard__time"><span>Текущее время</span><strong>{campaign.activeTime}</strong><small>Ведут: {mastersLabel(campaign)}</small></div></div></section>
    {customizing && <div className="overview-customize" role="region" aria-label="Настройка обзора"><p>Раскладка своя у каждого мастера ({acting.master.name}). Скрытые блоки:</p><div className="row">{layout.hidden.length ? layout.hidden.map((id) => <Button key={id} size="sm" icon="eye" onClick={() => saveLayout(toggleHidden(layout, id))}>Показать «{WIDGET_LABEL[id]}»</Button>) : <span className="muted">нет</span>}<Button size="sm" onClick={() => persist(withLayout(campaign, acting.master.id, null))}>Сбросить раскладку</Button></div></div>}
    <div className="target-dashboard__grid local-dashboard-grid">{visible.map((id, index) => <div key={id} className={`overview-widget${layout.wide.includes(id) ? ' target-panel--wide' : ''}`} data-widget={id}>{customizing && <div className="overview-widget__controls" role="toolbar" aria-label={`Блок «${WIDGET_LABEL[id]}»`}><strong>{WIDGET_LABEL[id]}</strong><Button size="sm" aria-label={`Выше: ${WIDGET_LABEL[id]}`} disabled={index === 0} onClick={() => saveLayout(moveWidget(layout, id, -1))}>↑</Button><Button size="sm" aria-label={`Ниже: ${WIDGET_LABEL[id]}`} disabled={index === visible.length - 1} onClick={() => saveLayout(moveWidget(layout, id, 1))}>↓</Button><Button size="sm" onClick={() => saveLayout(toggleWide(layout, id))}>{layout.wide.includes(id) ? 'Уже' : 'Шире'}</Button><Button size="sm" icon="eye-off" onClick={() => saveLayout(toggleHidden(layout, id))}>Скрыть</Button></div>}{widgets[id]}</div>)}</div>
    <p className="local-session-footnote"><Icon name={shared ? 'cloud' : 'hard-drive'} size={14} /> {shared ? 'Кампания хранится на сервере и видна её мастерам.' : 'Кампания хранится в этом браузере.'} {links.length ? `Подключено: ${links.join(', ')}.` : 'Мир, стол и система не подключены.'}</p>
    {editing && <Editor title="Редактировать кампанию" close={() => setEditing(false)}><label htmlFor="local-edit-name">Название<input id="local-edit-name" autoFocus value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} /></label><label htmlFor="local-edit-idea">Короткая идея<textarea id="local-edit-idea" rows={4} value={details.idea} onChange={(e) => setDetails({ ...details, idea: e.target.value })} /></label><div className="control-form__row"><label htmlFor="local-edit-time">Текущее время<input id="local-edit-time" value={details.activeTime} onChange={(e) => setDetails({ ...details, activeTime: e.target.value })} /></label><p className="muted">Мастера и игроки настраиваются в разделе «Команда».</p></div><footer><Button onClick={() => setEditing(false)}>Отмена</Button><Button variant="primary" icon="check" disabled={!details.name.trim()} onClick={saveCampaign}>Сохранить</Button></footer></Editor>}
  </>
}

/** One quick note with ways to turn it into a record (ТЗ-2, R6): an entity of a chosen type, a task, a clock, a secret. */
function InboxRow({ item, consume, remove }: { item: LocalInboxItem; consume: (target: InboxTarget, type?: LocalCampaignEntityType) => void; remove: () => void }) {
  const [type, setType] = useState<LocalCampaignEntityType>('npc')
  return <li className="inbox-row"><div className="inbox-row__text"><span>{item.text}</span>{item.tags.map((tag) => <Badge key={tag} tone="neutral" size="sm">#{tag}</Badge>)}</div>
    <div className="inbox-row__actions" role="group" aria-label={`Разобрать: ${item.text}`}>
      <select aria-label={`Тип для «${item.text}»`} value={type} onChange={(event) => setType(event.target.value as LocalCampaignEntityType)}>{ENTITY_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      <Button size="sm" onClick={() => consume('entity', type)}>В библиотеку</Button>
      <Button size="sm" onClick={() => consume('task')}>Задача</Button>
      <Button size="sm" onClick={() => consume('clock')}>Часы</Button>
      <Button size="sm" onClick={() => consume('secret')}>Секрет</Button>
      <Button size="sm" tone="danger" icon="trash-2" aria-label={`Удалить: ${item.text}`} onClick={remove} />
    </div></li>
}
