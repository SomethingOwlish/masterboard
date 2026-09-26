import { useState } from 'react'
import { Button, EmptyState, Select } from '../../ds'
import { ENTITY_FIELDS } from '../../local/domain'
import { ARC_STATUS, SECRET_STATUS, withSession } from '../../local/labels'
import { directorSheet, playerHandouts } from '../../local/printSheet'
import type { LocalPrintConfig, LocalSessionPlanItem } from '../../local/types'
import { PRIORITIES, USE_STATUS } from './plan/planApi'
import { ENTITY_LABEL, type SectionProps } from './shared'

type Sheet = 'director' | 'players'
const PRIORITY = Object.fromEntries(PRIORITIES) as Record<LocalSessionPlanItem['priority'], string>
const STATUS = Object.fromEntries(USE_STATUS) as Record<LocalSessionPlanItem['status'], string>
const TOGGLES: Array<[Exclude<keyof LocalPrintConfig, 'priorities'>, string]> = [['passport', 'Паспорт сессии'], ['notes', 'Заметки пунктов'], ['flows', 'Переходы'], ['entities', 'Карточки сущностей'], ['secrets', 'Секреты'], ['clocks', 'Часы']]

export function PrintSection({ campaign, persist }: SectionProps) {
  const sessions = campaign.sessionRecords
  const [sessionId, setSessionId] = useState(campaign.activeSessionId ?? sessions[0]?.id ?? '')
  const [sheet, setSheet] = useState<Sheet>('director')
  const session = sessions.find((item) => item.id === sessionId) ?? sessions[0]
  if (!session) return <EmptyState icon="printer" title="Печатать пока нечего" hint="Создайте сессию, и здесь появится режиссёрский лист." />
  const config = session.printConfig
  const setConfig = (patch: Partial<LocalPrintConfig>) => persist(withSession(campaign, { ...session, printConfig: { ...config, ...patch } }))
  const director = directorSheet(campaign, session)
  const handouts = playerHandouts(campaign, session)
  const title = (item: LocalSessionPlanItem) => item.secretId ? campaign.secrets.find((secret) => secret.id === item.secretId)?.title ?? item.text : item.entityId ? campaign.entities.find((entity) => entity.id === item.entityId)?.name ?? item.text : item.text
  const itemById = (id: string) => session.planItems.find((item) => item.id === id)
  const arcs = [session.arcId, ...session.backgroundArcIds].map((id) => campaign.storyArcs.find((arc) => arc.id === id)).filter((arc) => arc !== undefined)

  return <section className="campaign-section print-section">
    <div className="print-controls">
      <div className="panel-heading"><div><span className="panel-kicker">Печать и PDF</span><h2>Материалы к сессии</h2><p>Настройте лист и нажмите «Печать» — в диалоге браузера можно выбрать «Сохранить как PDF».</p></div><Button variant="primary" icon="printer" onClick={() => window.print()}>Печать</Button></div>
      <div className="print-controls__row"><label htmlFor="print-session">Сессия<Select id="print-session" value={session.id} onChange={(e) => setSessionId(e.target.value)}>{sessions.map((item) => <option key={item.id} value={item.id}>№{item.number} {item.title}</option>)}</Select></label><div className="campaign-relation-map__filters" role="group" aria-label="Что печатать"><button className={sheet === 'director' ? 'active' : ''} aria-pressed={sheet === 'director'} onClick={() => setSheet('director')}>Режиссёрский лист</button><button className={sheet === 'players' ? 'active' : ''} aria-pressed={sheet === 'players'} onClick={() => setSheet('players')}>Материалы игроков</button></div></div>
      {sheet === 'director' && <fieldset className="local-checklist print-controls__config"><legend>Что включить в лист</legend>{PRIORITIES.map(([priority, label]) => <label key={priority}><input type="checkbox" checked={config.priorities.includes(priority)} onChange={() => setConfig({ priorities: config.priorities.includes(priority) ? config.priorities.filter((item) => item !== priority) : PRIORITIES.map(([value]) => value).filter((value) => value === priority || config.priorities.includes(value)) })} /> {label}</label>)}{TOGGLES.map(([key, label]) => <label key={key}><input type="checkbox" checked={config[key]} onChange={() => setConfig({ [key]: !config[key] })} /> {label}</label>)}</fieldset>}
    </div>

    {sheet === 'director' ? <article className="print-sheet" aria-label="Режиссёрский лист">
      <header className="print-sheet__header"><span>{campaign.name} · режиссёрский лист</span><h1>Сессия {session.number}: {session.title}</h1></header>
      {config.passport && <dl className="print-sheet__passport"><div><dt>Мастер</dt><dd>{session.master || '—'}</dd></div><div><dt>Группа</dt><dd>{[session.group, session.participants].filter(Boolean).join(' · ') || '—'}</dd></div><div><dt>Время</dt><dd>{session.inGameTime || campaign.activeTime}</dd></div><div><dt>Линии</dt><dd>{arcs.length ? arcs.map((arc) => `${arc.title} (${ARC_STATUS[arc.status].toLocaleLowerCase()}, ${arc.progress}%)`).join('; ') : '—'}</dd></div>{session.focus && <div className="wide"><dt>Цель</dt><dd>{session.focus}</dd></div>}{session.opening && <div className="wide"><dt>Старт</dt><dd>{session.opening}</dd></div>}</dl>}
      {director.groups.map((group) => <section key={group.priority} className="print-sheet__group"><h2>{PRIORITY[group.priority]}</h2><ol>{group.items.map((item) => { const scene = item.sceneId ? itemById(item.sceneId) : undefined; return <li key={item.id}><strong>{title(item)}</strong> <small>{[STATUS[item.status], item.alternative && `или: ${item.alternative}`, scene && `в сцене «${title(scene)}»`].filter(Boolean).join(' · ')}</small>{config.notes && item.note && <p>{item.note}</p>}</li> })}</ol></section>)}
      {config.flows && session.flows.length > 0 && <section className="print-sheet__group"><h2>Переходы</h2><ul>{session.flows.map((flow) => { const from = itemById(flow.fromItemId); const to = itemById(flow.toItemId); return from && to ? <li key={flow.id}>{title(from)} → {title(to)}{flow.condition && `, если ${flow.condition}`}</li> : null })}</ul></section>}
      {director.secrets.length > 0 && <section className="print-sheet__group"><h2>Секреты</h2>{director.secrets.map((secret) => <div key={secret.id} className="print-sheet__card"><strong>{secret.title}</strong> <small>{SECRET_STATUS[secret.status]}</small><p>{secret.truth}</p>{secret.revealCondition && <p><em>Раскрыть: {secret.revealCondition}</em></p>}{secret.publicVersion && <p>Игрокам: {secret.publicVersion}</p>}</div>)}</section>}
      {director.clocks.length > 0 && <section className="print-sheet__group"><h2>Часы</h2><ul className="print-sheet__clocks">{director.clocks.map((clock) => <li key={clock.id}><strong>{clock.title}</strong> <span className="print-sheet__track">{'●'.repeat(clock.value)}{'○'.repeat(clock.segments - clock.value)}</span> {clock.trigger && <small>→ {clock.trigger}</small>}</li>)}</ul></section>}
      {director.entities.length > 0 && <section className="print-sheet__group"><h2>Карточки</h2><div className="print-sheet__cards">{director.entities.map((entity) => <div key={entity.id} className="print-sheet__card"><small>{ENTITY_LABEL[entity.type]}</small><strong>{entity.name}</strong>{entity.description && <p>{entity.description}</p>}{ENTITY_FIELDS[entity.type].filter((field) => entity.fields[field.id]).map((field) => <p key={field.id}><b>{field.label}:</b> {entity.fields[field.id]}</p>)}</div>)}</div></section>}
    </article> : <article className="print-sheet print-sheet--players" aria-label="Материалы игроков">
      <header className="print-sheet__header"><span>{campaign.name}</span><h1>Сессия {session.number}: {session.title}</h1></header>
      {!handouts.entities.length && !handouts.secrets.length && !handouts.clocks.length && <p className="muted print-hide">Для игроков пока ничего нет. В лист попадают сущности из плана с видимостью «Для игроков», раскрытые секреты с публичной формулировкой и открытые часы.</p>}
      <div className="print-sheet__cards">
        {handouts.entities.map((entity) => <div key={entity.id} className="print-sheet__card print-sheet__handout"><small>{ENTITY_LABEL[entity.type]}</small><strong>{entity.name}</strong>{entity.description && <p>{entity.description}</p>}</div>)}
        {handouts.secrets.map((secret) => <div key={secret.id} className="print-sheet__card print-sheet__handout"><small>Вы узнали</small><strong>{secret.title}</strong><p>{secret.text}</p></div>)}
        {handouts.clocks.map((clock) => <div key={clock.id} className="print-sheet__card print-sheet__handout"><small>Часы</small><strong>{clock.title}</strong><p className="print-sheet__track">{'●'.repeat(clock.value)}{'○'.repeat(clock.segments - clock.value)}</p></div>)}
      </div>
    </article>}
  </section>
}
