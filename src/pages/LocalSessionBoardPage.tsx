import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Icon } from '../ds'
import { localSessionBoardDemo } from '../fixtures/localDemoRuntime'
import type { BoardItem, BoardItemKind, LocalSessionBoardSnapshot } from '../fixtures/localSessionBoardDemo'

const KIND_LABEL: Record<BoardItemKind, string> = {
  character: 'Player', npc: 'NPC', location: 'Location', event: 'Event', misc: 'Clue',
}

const KIND_ICON: Record<BoardItemKind, string> = {
  character: 'users', npc: 'drama', location: 'map-pin', event: 'calendar', misc: 'scroll-text',
}

export function LocalSessionBoardPage() {
  const demo = useMemo(() => localSessionBoardDemo, [])
  const [board, setBoard] = useState<LocalSessionBoardSnapshot>(() => demo.read())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(true)
  const [filter, setFilter] = useState<BoardItemKind | 'all'>('all')

  const selected = board.items.find((item) => item.id === selectedId) ?? null
  const used = new Set(board.scenes.flatMap((scene) => scene.itemIds))
  const palette = board.items.filter((item) => filter === 'all' || item.kind === filter)

  const move = (itemId: string, sceneId: string) => {
    setBoard(demo.moveItem(itemId, sceneId))
    setSelectedId(itemId)
  }

  return (
    <main className="session-board-demo">
      <header className="session-board-demo__topbar">
        <div className="session-board-demo__crumbs">
          <Link to="/demo/campaign">Moon Port</Link><span>/</span><Link to="/demo/session">Opening Night</Link><span>/</span><strong>Plan</strong>
        </div>
        <div className="session-board-demo__top-actions">
          <Badge tone="neutral" dot>Local fake workspace</Badge>
          <Button size="sm" variant={board.ready ? 'soft' : 'primary'} icon="check" onClick={() => setBoard(demo.toggleReady())}>
            {board.ready ? 'Prepared' : 'Mark prepared'}
          </Button>
        </div>
      </header>

      <section className="session-board-demo__heading">
        <div><span className="panel-kicker">Session #01 · September 5</span><h1>Opening Night at Moon Port</h1><p>Build the playable path, then conduct it from the same fake workspace.</p></div>
        <div className="session-board-demo__status"><span>{board.scenes.length} scenes</span><span>{used.size} linked objects</span><span>Revision {board.revision}</span></div>
      </section>

      <div className={`session-board-demo__workspace${paletteOpen ? '' : ' is-palette-closed'}`}>
        <aside className="session-palette" aria-label="Linked object palette">
          <div className="panel-heading">
            <div><span className="panel-kicker">Live references</span><h2 className="section-title">Session palette</h2></div>
            <button className="session-board-demo__close" onClick={() => setPaletteOpen(false)} aria-label="Close palette">×</button>
          </div>
          <div className="session-palette__filters">
            {(['all', 'character', 'npc', 'location', 'event', 'misc'] as const).map((kind) => (
              <button key={kind} className={filter === kind ? 'is-active' : ''} onClick={() => setFilter(kind)}>{kind === 'all' ? 'All' : KIND_LABEL[kind]}</button>
            ))}
          </div>
          <div className="session-palette__list">
            {palette.map((item) => <ItemCard key={item.id} item={item} used={used.has(item.id)} onSelect={() => setSelectedId(item.id)} />)}
          </div>
          <p className="session-palette__hint">Select an object, then place it into a scene from the inspector.</p>
        </aside>

        <section className="session-flow" aria-label="Session scene flow">
          <div className="session-flow__toolbar">
            {!paletteOpen && <Button size="sm" icon="plus" onClick={() => setPaletteOpen(true)}>Objects</Button>}
            <span>Playable order</span><span className="session-flow__legend"><i /> Main path</span>
          </div>
          <div className="session-flow__scenes">
            {board.scenes.map((scene, index) => (
              <article className="session-scene" key={scene.id}>
                <div className="session-scene__sequence"><span>{String(index + 1).padStart(2, '0')}</span>{index < board.scenes.length - 1 && <i />}</div>
                <div className="session-scene__card">
                  <header><div><span className="panel-kicker">Scene {index + 1}</span><h2>{scene.title}</h2></div><div className="session-scene__order"><button onClick={() => setBoard(demo.reorderScene(scene.id, -1))} disabled={index === 0} aria-label="Move scene earlier">↑</button><button onClick={() => setBoard(demo.reorderScene(scene.id, 1))} disabled={index === board.scenes.length - 1} aria-label="Move scene later">↓</button></div></header>
                  <p className="session-scene__purpose">{scene.purpose}</p>
                  <blockquote>{scene.beat}</blockquote>
                  <div className="session-scene__items">
                    {scene.itemIds.map((id) => {
                      const item = board.items.find((candidate) => candidate.id === id)
                      return item ? <button key={id} onClick={() => setSelectedId(id)} className={selectedId === id ? 'is-selected' : ''}><Icon name={KIND_ICON[item.kind]} size={15} /><span>{item.name}</span><small>{KIND_LABEL[item.kind]}</small></button> : null
                    })}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className={`session-inspector${selected ? ' is-open' : ''}`} aria-label="Object inspector">
          {selected ? <>
            <div className="panel-heading"><div><span className="panel-kicker">Linked object</span><h2 className="section-title">{selected.name}</h2></div><button className="session-board-demo__close" onClick={() => setSelectedId(null)} aria-label="Close inspector">×</button></div>
            <Badge tone="neutral">{KIND_LABEL[selected.kind]}</Badge>
            <p>{selected.detail}</p>
            <div className="session-inspector__tags">{selected.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
            <div className="session-inspector__placement"><span className="panel-kicker">Place in scene</span>{board.scenes.map((scene, index) => <button key={scene.id} className={scene.itemIds.includes(selected.id) ? 'is-current' : ''} onClick={() => move(selected.id, scene.id)}><span>{index + 1}</span>{scene.title}{scene.itemIds.includes(selected.id) && <Icon name="check" size={15} />}</button>)}</div>
            <p className="session-inspector__sync"><Icon name="refresh-cw" size={14} /> Live fake reference · source changes would appear here.</p>
          </> : <div className="session-inspector__empty"><Icon name="pointer" size={22} /><p>Select an object to inspect and place it.</p></div>}
        </aside>
      </div>
      <footer className="session-board-demo__footer"><span>Simulation only · reload resets the board</span><Link to="/demo/conductor">Conduct this session <Icon name="arrow-right" size={15} /></Link></footer>
    </main>
  )
}

function ItemCard({ item, used, onSelect }: { item: BoardItem; used: boolean; onSelect: () => void }) {
  return <button className="session-palette__item" onClick={onSelect}><span className={`session-palette__icon is-${item.kind}`}><Icon name={KIND_ICON[item.kind]} size={16} /></span><span><strong>{item.name}</strong><small>{KIND_LABEL[item.kind]} · {item.detail}</small></span>{used && <i title="Placed" />}</button>
}
