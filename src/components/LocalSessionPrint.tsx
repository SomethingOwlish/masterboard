import { selectedSessionNumber, sessionPath } from '../lib/localSessions'
import { Link } from 'react-router-dom'
import { SessionBoardSnapshot } from './SessionBoardSnapshot'
import { Button } from '../ds'
import type { LocalCampaignRecord } from '../fixtures/localCampaignCatalog'

export function LocalSessionPrint({ campaign }: { campaign: LocalCampaignRecord }) {
  const usedIds = new Set(campaign.firstSessionScenes.flatMap((scene) => scene.memberIds ?? []))
  const entities = campaign.entities.filter((entity) => entity.type === 'character' || usedIds.has(entity.id))
  return <main className="local-print-sheet">
    <nav><Link to={sessionPath(campaign, 'session')}>Вернуться к подготовке</Link><Button onClick={() => window.print()}>Печать / PDF</Button></nav>
    <header><p>{campaign.name} · Сессия #{selectedSessionNumber(campaign)} · {campaign.firstSessionDate || 'Без даты'} · Материалы ведущего</p><h1>{campaign.firstSessionTitle || 'План сессии'}</h1><p>{campaign.firstSessionObjective}</p></header>
    <h2>Вступление</h2><p>{campaign.firstSessionOpening}</p>
    <h2>Доска сцен</h2><SessionBoardSnapshot scenes={campaign.firstSessionScenes} entities={campaign.entities} />
    <h2>План</h2>{campaign.firstSessionScenes.map((scene, index) => <article key={scene.id}><h3>{index + 1}. {scene.title}</h3><p>{scene.purpose}</p><p>{(scene.memberIds ?? []).map((id) => campaign.entities.find((entity) => entity.id === id)?.name).filter(Boolean).join(' · ')}</p></article>)}
    <h2>Персонажи и материалы сцен</h2>{entities.map((entity) => <article key={entity.id}><h3>{entity.name}</h3><p>{entity.description}</p><small>{entity.tags.join(', ')}</small></article>)}
    {campaign.firstSessionRecap && <><h2>Итоги сессии</h2><p>{campaign.firstSessionRecap}</p></>}
    {!!campaign.firstSessionLog.length && <><h2>Журнал игры</h2>{campaign.firstSessionLog.map((entry) => <p key={entry.id}>{entry.text}</p>)}</>}
  </main>
}
