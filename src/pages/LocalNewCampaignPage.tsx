import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Badge, Button, EmptyState, Icon } from '../ds'
import { localCampaignCatalog } from '../fixtures/localCampaignCatalog'

export function LocalNewCampaignPage() {
  const { campaignId = '' } = useParams()
  const initial = localCampaignCatalog.find(campaignId)
  const [campaign, setCampaign] = useState(initial)
  const [note, setNote] = useState('')
  const [sessionTitle, setSessionTitle] = useState(initial?.firstSessionTitle ?? '')
  if (!campaign) return <Navigate to="/" replace />
  const saveSession = () => { const title = sessionTitle.trim(); if (!title) return; setCampaign(localCampaignCatalog.update({ ...campaign, firstSessionTitle: title, sessions: 1 })) }
  const addNote = () => { const text = note.trim(); if (!text) return; setCampaign(localCampaignCatalog.update({ ...campaign, notes: [...campaign.notes, text] })); setNote('') }
  const ready = campaign.notes.length > 0 && Boolean(campaign.firstSessionTitle)

  return <main className="new-campaign-room">
    <header className="new-campaign-room__topbar"><Link to="/"><Icon name="arrow-left" size={16} /> Все кампании</Link><Badge tone="neutral" dot>Сохранено в браузере</Badge></header>
    <section className="new-campaign-room__hero"><div><span className="panel-kicker">Новая локальная кампания</span><h1>{campaign.name}</h1><p>{campaign.idea}</p></div><div className={`new-campaign-room__readiness ${ready ? 'ready' : ''}`}><span>{ready ? 'Можно начинать' : 'Первичная настройка'}</span><strong>{Number(Boolean(campaign.firstSessionTitle)) + Number(campaign.notes.length > 0)} / 2</strong></div></section>
    <div className="new-campaign-room__layout">
      <section className="new-campaign-room__main">
        {!campaign.notes.length ? <EmptyState icon="book-open" title="Мир пока пуст" hint="Запишите первый факт, персонажа или место. Этого достаточно, чтобы история начала обретать форму." action={<div className="new-campaign-room__capture"><input id="first-note" name="first-note" value={note} placeholder="Например: город построен на спящем ките" onChange={(event) => setNote(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addNote() }} /><Button variant="primary" icon="plus" disabled={!note.trim()} onClick={addNote}>Добавить</Button></div>} /> : <><div className="panel-heading"><div><span className="panel-kicker">Первые опорные точки</span><h2>Заметки кампании</h2></div><span className="panel-state">{campaign.notes.length}</span></div><ol className="new-campaign-room__notes">{campaign.notes.map((item, index) => <li key={`${item}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></li>)}</ol><div className="new-campaign-room__capture"><input id="next-note" name="next-note" value={note} placeholder="Добавить ещё одну опорную точку…" onChange={(event) => setNote(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addNote() }} /><Button icon="plus" disabled={!note.trim()} onClick={addNote}>Добавить</Button></div></>}
      </section>
      <aside className="new-campaign-room__setup"><span className="panel-kicker">Быстрый старт</span><h2>Подготовьте первую игру</h2><label htmlFor="first-session">Название первой сессии<input id="first-session" name="first-session" value={sessionTitle} placeholder="Встреча у старых ворот" onChange={(event) => setSessionTitle(event.target.value)} /></label><Button variant="primary" block disabled={!sessionTitle.trim() || sessionTitle.trim() === campaign.firstSessionTitle} onClick={saveSession}>{campaign.firstSessionTitle ? 'Обновить сессию' : 'Создать сессию'}</Button><div className="new-campaign-room__steps"><span className={campaign.notes.length ? 'done' : ''}><Icon name={campaign.notes.length ? 'check' : 'circle'} size={16} /> Добавить опорную точку</span><span className={campaign.firstSessionTitle ? 'done' : ''}><Icon name={campaign.firstSessionTitle ? 'check' : 'circle'} size={16} /> Создать первую сессию</span></div>{ready && <div className="new-campaign-room__ready"><Icon name="check" size={18} /><span><strong>Основа готова</strong><small>После подключения общего хранилища эту кампанию можно будет передать команде.</small></span></div>}</aside>
    </div>
    <p className="local-session-footnote"><Icon name="hard-drive" size={14} /> Данные сохраняются после перезагрузки, но остаются только в этом браузере.</p>
  </main>
}
