import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SessionBoardSnapshot } from './SessionBoardSnapshot'
import { Button, Badge } from '../ds'
import { useToast } from './useToast'
import type { LocalCampaignRecord } from '../fixtures/localCampaignCatalog'
import { createLocalSession, deleteLocalSession, duplicateLocalSession, restoreLocalSession, sessionPath, syncLocalSessions } from '../lib/localSessions'

const STATUS = { draft: 'Подготовка', ready: 'Готова', active: 'Идёт сейчас', completed: 'Завершена' }
export function LocalSessionHistory({ campaign, onChange }: { campaign: LocalCampaignRecord; onChange: (next: LocalCampaignRecord) => boolean }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const navigate = useNavigate()
  const toast = useToast()
  const documents = syncLocalSessions(campaign).sessionDocuments!
  const sessions = documents.filter((session) => !session.deletedAt)
  const removed = documents.filter((session) => session.deletedAt)
  const act = (change: () => LocalCampaignRecord, open = false) => {
    try {
      const next = change()
      if (onChange(next) && open) navigate(sessionPath(next, 'session'))
    } catch (error) { toast({ tone: 'danger', message: String(error), duration: 0 }) }
  }
  return <section className="campaign-section session-catalog">
    <h2>Сессии кампании</h2>
    <form className="session-catalog__create" onSubmit={(event) => { event.preventDefault(); act(() => createLocalSession(campaign, title, date), true) }}>
      <label>Название новой сессии<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>Дата игры<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <Button type="submit" variant="primary" disabled={!title.trim()}>Создать сессию</Button>
    </form>
    <p>Можно готовить несколько будущих игр. У каждой свой план, доска и журнал.</p>
    {!sessions.length && <p>Создайте первую сессию.</p>}
    {sessions.map((session) => <article className="session-catalog__card" key={session.id}>
      <header><div><span className="panel-kicker">Сессия #{session.seq}{session.realDate ? ` · ${session.realDate}` : ''}</span><h3><Link to={sessionPath(campaign, session.status === 'active' ? 'play' : 'session', session.id)}>{session.title}</Link></h3></div><Badge tone={session.status === 'active' ? 'success' : 'neutral'}>{STATUS[session.status]}</Badge></header>
      <p>{session.objective || 'Цель пока не задана.'}</p>
      <div className="row"><Link to={sessionPath(campaign, 'session', session.id)}>План и доска</Link><Link to={sessionPath(campaign, 'print', session.id)}>Печать / PDF</Link>{['ready', 'active', 'completed'].includes(session.status) && <Link to={sessionPath(campaign, 'play', session.id)}>{session.status === 'completed' ? 'Журнал и итоги' : 'Игровой стол'}</Link>}<Button size="sm" onClick={() => act(() => duplicateLocalSession(campaign, session.id), true)}>Дублировать</Button><Button size="sm" tone="danger" disabled={session.status === 'active'} onClick={() => act(() => deleteLocalSession(campaign, session.id))}>В корзину</Button></div>
      {session.status === 'completed' && <details className="session-archive"><summary>План и результаты</summary><p>{session.recap || 'Итоги ещё не записаны.'}</p><SessionBoardSnapshot scenes={session.scenes} entities={campaign.entities} /><ol>{session.log.map((entry) => <li key={entry.id}>{entry.text}</li>)}</ol></details>}
    </article>)}
    {!!removed.length && <details className="session-archive"><summary>Корзина · {removed.length}</summary>{removed.map((session) => <div className="session-catalog__trash" key={session.id}><span>#{session.seq} · {session.title}</span><Button onClick={() => act(() => restoreLocalSession(campaign, session.id))}>Восстановить</Button></div>)}</details>}
  </section>
}
