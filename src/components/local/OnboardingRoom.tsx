import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, EmptyState, Icon } from '../../ds'
import { blankSession, withLocalSessions } from '../../local/normalize'
import { ownerOf } from '../../local/team'
import { Capture, StorageBadge, type SectionProps } from './shared'
import { ROLE_LABEL, SYSTEM_LABEL, linkedRole, type CampaignRole } from '../../local/integration'
import { ImportDialog } from './SourcePanels'
import { IDEA_PLACEHOLDER } from '../../local/labels'

const ROLES: CampaignRole[] = ['world', 'table', 'system']

/** First screen of a new campaign: collect anchor notes and create session 1. */
export function OnboardingRoom({ campaign, persist }: SectionProps) {
  const [note, setNote] = useState('')
  const [title, setTitle] = useState('')
  const [params, setParams] = useSearchParams()
  const importing = params.get('import') === 'base'
  const base = ROLES.flatMap((role) => { const linked = linkedRole(campaign, role); return linked ? [`${ROLE_LABEL[role]}: ${SYSTEM_LABEL[linked.system]} · ${linked.link.label}`] : [] })
  const addNote = () => { const text = note.trim(); if (!text) return; persist({ ...campaign, notes: [...campaign.notes, text] }); setNote('') }
  const createSession = () => {
    if (!title.trim()) return
    const session = { ...blankSession(1, ownerOf(campaign).id, new Date().toISOString()), title: title.trim() }
    persist(withLocalSessions(campaign, [session], session.id))
  }
  return <main className="new-campaign-room"><header className="new-campaign-room__topbar"><Link to="/"><Icon name="arrow-left" size={16} /> Все кампании</Link><StorageBadge campaignId={campaign.id} /></header><section className="new-campaign-room__hero"><div><span className="panel-kicker">Новая кампания</span><h1>{campaign.name}</h1><p className={campaign.idea ? undefined : 'muted'}>{campaign.idea || IDEA_PLACEHOLDER}</p></div><div className="new-campaign-room__readiness"><span>Первичная настройка</span><strong>{campaign.notes.length ? 'Мир начат' : 'Мир пуст'}</strong></div></section><div className="new-campaign-room__layout"><section className="new-campaign-room__main">{!campaign.notes.length ? <EmptyState icon="book-open" title="Мир пока пуст" hint="Запишите первый факт, персонажа или место." action={<Capture value={note} setValue={setNote} add={addNote} />} /> : <><div className="panel-heading"><div><span className="panel-kicker">Первые опорные точки</span><h2>Заметки кампании</h2></div></div><ol className="new-campaign-room__notes">{campaign.notes.map((item, index) => <li key={`${item}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></li>)}</ol><Capture value={note} setValue={setNote} add={addNote} /></>}</section><aside className="new-campaign-room__setup">{base.length > 0 && <div className="new-campaign-room__base"><span className="panel-kicker">Основа</span><ul>{base.map((line) => <li key={line}><Icon name="check" size={14} /> {line}</li>)}</ul><Button icon="download" block onClick={() => setParams({ import: 'base' })}>Выбрать записи из основы</Button><small className="muted">В библиотеке: {campaign.entities.length}</small></div>}<span className="panel-kicker">Быстрый старт</span><h2>Подготовьте первую игру</h2><label htmlFor="first-session">Название первой сессии<input id="first-session" value={title} placeholder="Встреча у старых ворот" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createSession() }} /></label><Button variant="primary" block disabled={!title.trim()} onClick={createSession}>Создать сессию и открыть дашборд</Button><div className="new-campaign-room__steps"><span className={campaign.notes.length ? 'done' : ''}><Icon name={campaign.notes.length ? 'check' : 'circle'} size={16} /> Добавить опорную точку (по желанию)</span><span><Icon name="circle" size={16} /> Создать первую сессию</span></div></aside></div><p className="local-session-footnote"><Icon name="info" size={14} /> Дашборд кампании откроется сразу после создания первой сессии.</p>{importing && <ImportDialog campaign={campaign} persist={persist} stay close={() => setParams({})} />}</main>
}
