import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button } from '../ds'
import { localSessionBoardDemo } from '../fixtures/localDemoRuntime'
import type { LocalCampaignEntity, LocalSessionScene } from '../fixtures/localCampaignCatalog'

const LocalSessionBoard = lazy(() => import('../components/LocalSessionBoard').then((module) => ({ default: module.LocalSessionBoard })))

/** Demo data adapter only. All board interactions use the production component. */
export function LocalSessionBoardPage() {
  const [board, setBoard] = useState(() => localSessionBoardDemo.read())
  const scenes: LocalSessionScene[] = board.scenes.map(({ itemIds, ...scene }) => ({ ...scene, memberIds: itemIds }))
  const entities: LocalCampaignEntity[] = board.items.map((item) => ({ id: item.id, name: item.name, type: item.kind === 'misc' ? 'item' : item.kind, description: item.detail, tags: item.tags }))
  return <main className="session-board-demo">
    <header className="session-board-demo__topbar"><div className="session-board-demo__crumbs"><Link to="/demo/campaign">Лунный порт</Link><span>/</span><Link to="/demo/session">Первая ночь</Link><span>/</span><strong>План</strong></div><Badge tone="neutral">Демонстрационный стенд</Badge></header>
    <section className="session-board-demo__heading"><div><span className="panel-kicker">Сессия №01</span><h1>Первая ночь в Лунном порту</h1><p>Тот же планировщик, что в реальных кампаниях. Данные этого примера сбрасываются при перезагрузке.</p></div><Button onClick={() => setBoard(localSessionBoardDemo.toggleReady())}>{board.ready ? 'Вернуть в подготовку' : 'Отметить готовой'}</Button></section>
    <Suspense fallback={<p role="status">Загружаем доску…</p>}><LocalSessionBoard scenes={scenes} entities={entities} savedLabel="Стенд: изменения сохраняются до перезагрузки" onChange={(next) => { setBoard(localSessionBoardDemo.replaceScenes(next)); return true }} /></Suspense>
  </main>
}
