import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Icon } from '../ds'
import { localCampaignCatalog } from '../fixtures/localCampaignCatalog'

export function LocalCampaignsPage() {
  const initial = localCampaignCatalog.load()
  const [campaigns, setCampaigns] = useState(initial.campaigns)
  const [recovered, setRecovered] = useState(initial.recovered)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [idea, setIdea] = useState('')
  const create = () => { if (!name.trim()) return; const campaign = localCampaignCatalog.create(name, idea); setCampaigns(localCampaignCatalog.load().campaigns); setCreating(false); setName(''); setIdea(''); window.setTimeout(() => document.getElementById(`campaign-${campaign.id}`)?.focus(), 0) }
  return <main className="campaign-workspace">
    <header className="campaign-workspace__topbar"><div className="campaign-workspace__brand"><span>М</span><strong>Мастерборд</strong></div><div><Badge tone="neutral" dot>Локальные тестовые данные</Badge><button aria-label="Профиль ведущего">С</button></div></header>
    <section className="campaign-workspace__hero"><div><span className="panel-kicker">Рабочее пространство ведущего</span><h1>Кампании</h1><p>Истории, подготовка и сессии вашей команды — в одном месте.</p></div><Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Создать кампанию</Button></section>
    {recovered && <div className="campaign-workspace__recovery" role="alert"><Icon name="triangle-alert" size={18} /><span><strong>Локальные данные были повреждены.</strong> Мы безопасно вернули тестовую кампанию.</span><button onClick={() => setRecovered(false)} aria-label="Закрыть сообщение"><Icon name="x" size={16} /></button></div>}
    <section className="campaign-workspace__grid" aria-label="Список кампаний">
      {campaigns.map((campaign, index) => <article key={campaign.id} className="campaign-workspace__card"><Link id={`campaign-${campaign.id}`} to={campaign.id === 'moon-port' ? '/demo/campaign' : `/local/campaign/${campaign.id}`}><div className="campaign-workspace__cover"><span>{String(index + 1).padStart(2, '0')}</span><i>{campaign.name.slice(0, 1)}</i></div><div className="campaign-workspace__body"><span className="panel-kicker">{campaign.sessions ? `${campaign.sessions} сессия` : 'Без сессий'}</span><h2>{campaign.name}</h2><p>{campaign.idea}</p><dl><div><dt>Текущее время</dt><dd>{campaign.activeTime}</dd></div><div><dt>Ведущие</dt><dd>{campaign.masters}</dd></div></dl></div><footer><span>{campaign.id === 'moon-port' ? 'Открыть кампанию' : 'Продолжить подготовку'}</span><Icon name="arrow-right" size={17} /></footer></Link></article>)}
      <button className="campaign-workspace__new" onClick={() => setCreating(true)}><Icon name="plus" size={24} /><strong>Новая кампания</strong><span>Начать с чистого пространства</span></button>
    </section>
    <p className="campaign-workspace__boundary"><Icon name="hard-drive" size={15} /> Всё остаётся в браузере. Интеграции пока отключены.</p>
    {creating && <div className="campaign-workspace__scrim"><section className="campaign-workspace__modal" role="dialog" aria-modal="true" aria-labelledby="new-campaign-title"><span className="panel-kicker">Новая кампания</span><h2 id="new-campaign-title">С чего начинается история?</h2><label htmlFor="campaign-name">Название<input autoFocus id="campaign-name" name="campaign-name" value={name} placeholder="Например, Город под стеклом" onChange={(event) => setName(event.target.value)} /></label><label htmlFor="campaign-idea">Короткая идея<textarea id="campaign-idea" name="campaign-idea" rows={4} value={idea} placeholder="О чём эта кампания?" onChange={(event) => setIdea(event.target.value)} /></label><p><Icon name="hard-drive" size={15} /> Кампания создастся только в локальном тестовом пространстве.</p><div><Button onClick={() => setCreating(false)}>Отмена</Button><Button variant="primary" icon="plus" disabled={!name.trim()} onClick={create}>Создать</Button></div></section></div>}
  </main>
}
