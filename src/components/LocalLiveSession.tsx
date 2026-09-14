import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, EmptyState, Icon, Select } from '../ds'
import type { LocalCampaignEntityType, LocalCampaignRecord, LocalSessionItem, LocalSessionScene } from '../fixtures/localCampaignCatalog'

type Props = {
  campaign: LocalCampaignRecord
  persist: (next: LocalCampaignRecord) => void
  startSession: () => void
  currentScene?: LocalSessionScene
}

type DeskTab = 'context' | 'flows' | 'clocks' | 'secrets'
type CaptureKind = 'note' | 'inbox' | 'task' | 'npc' | 'location' | 'item' | 'secret'

const statusLabels: Record<LocalSessionItem['status'], string> = {
  prepared: 'Подготовлено', current: 'Сейчас', used: 'Использовано', skipped: 'Пропущено', moved: 'Перенесено', cancelled: 'Отменено',
}
const captureLabels: Record<CaptureKind, string> = { note: 'Событие', inbox: 'Во входящие', task: 'Задача', npc: 'Персонаж', location: 'Локация', item: 'Предмет', secret: 'Секрет' }

export function LocalLiveSession({ campaign, persist, startSession, currentScene }: Props) {
  const [tab, setTab] = useState<DeskTab>('context')
  const [captureKind, setCaptureKind] = useState<CaptureKind>('note')
  const [capture, setCapture] = useState('')
  const [clockReasons, setClockReasons] = useState<Record<string, string>>({})
  const items = campaign.firstSessionItems ?? []
  const flows = campaign.firstSessionFlows ?? []
  const linked = items.map((item) => ({ item, entity: campaign.entities.find((entity) => entity.id === item.entityId) })).filter((row) => row.entity)
  const itemName = (id: string) => linked.find((row) => row.item.id === id)?.entity?.name ?? 'Удалённый элемент'
  const saveItemStatus = (id: string, status: LocalSessionItem['status']) => persist({ ...campaign, firstSessionItems: items.map((item) => item.id === id ? { ...item, status } : item) })
  const addLog = (text: string, next: LocalCampaignRecord = campaign) => ({ ...next, firstSessionLog: [...next.firstSessionLog, { id: `log-${crypto.randomUUID()}`, text, createdAt: new Date().toISOString() }] })
  const submitCapture = () => {
    const text = capture.trim()
    if (!text) return
    const stamp = new Date().toISOString()
    let next = campaign
    if (captureKind === 'inbox') next = { ...next, inbox: [...next.inbox, { id: `inbox-${crypto.randomUUID()}`, text, tags: ['из игры'], createdAt: stamp }] }
    else if (captureKind === 'task') next = { ...next, tasks: [...next.tasks, { id: `task-${crypto.randomUUID()}`, text, source: 'inbox', done: false }] }
    else if (captureKind === 'secret') next = { ...next, secrets: [...next.secrets, { id: `secret-${crypto.randomUUID()}`, title: text, truth: '', publicVersion: '', recipients: '', status: 'hidden' }] }
    else if (captureKind !== 'note') next = { ...next, entities: [...next.entities, { id: `entity-${crypto.randomUUID()}`, type: captureKind as LocalCampaignEntityType, name: text, description: 'Создано во время игры', tags: ['из игры'], visibility: 'master', status: 'active' }] }
    persist(addLog(captureKind === 'note' ? text : `${captureLabels[captureKind]}: ${text}`, next))
    setCapture('')
  }
  const moveClock = (id: string, delta: number) => {
    const reason = clockReasons[id]?.trim()
    if (!reason) return
    persist({ ...campaign, clocks: campaign.clocks.map((clock) => clock.id === id ? { ...clock, value: Math.max(0, Math.min(clock.segments, clock.value + delta)), history: [...clock.history, { id: crypto.randomUUID(), delta, reason, createdAt: new Date().toISOString() }] } : clock) })
    setClockReasons((current) => ({ ...current, [id]: '' }))
  }

  const completed = campaign.firstSessionStatus === 'completed'
  const active = campaign.firstSessionStatus === 'active'
  return <main className="campaign-live-session live-desk">
    <header><Link to={`/local/campaign/${campaign.id}/session`}><Icon name="arrow-left" size={16} /> Подготовка</Link><div className="row"><Badge tone={completed ? 'neutral' : active ? 'success' : campaign.firstSessionStatus === 'ready' ? 'accent' : 'warning'} dot>{completed ? 'Завершена' : active ? 'Идёт сейчас' : campaign.firstSessionStatus === 'ready' ? 'Готова' : 'Нужна проверка'}</Badge></div></header>
    <section className="live-desk__heading"><div><span className="panel-kicker">Игровой стол · {campaign.name}</span><h1>{campaign.firstSessionTitle}</h1></div><p>{campaign.firstSessionObjective}</p>{completed && <Link className="live-desk__review" to={`/local/campaign/${campaign.id}/review`}>Разобрать сессию <Icon name="arrow-right" size={15} /></Link>}</section>
    {!active && !completed ? <section className="campaign-live-session__launch"><Icon name="clapperboard" size={28} /><h2>{campaign.firstSessionStatus === 'ready' ? 'Всё готово к игре' : 'Проверьте подготовку'}</h2><p>{campaign.firstSessionStatus === 'ready' ? 'Сцены, контекст, часы и секреты останутся под рукой на одном экране.' : 'Сессия ещё помечена как черновик. Её можно запустить для теста или вернуться и дополнить.'}</p><Button variant="primary" icon="play" onClick={startSession}>Начать сессию</Button></section> : <>
      <section className="live-desk__capture"><Select aria-label="Тип быстрой записи" value={captureKind} onChange={(event) => setCaptureKind(event.target.value as CaptureKind)}>{Object.entries(captureLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><input value={capture} aria-label="Быстрая запись во время игры" placeholder="Записать, не покидая игровой стол…" disabled={completed} onChange={(event) => setCapture(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitCapture() }} /><Button variant="primary" icon="plus" disabled={completed || !capture.trim()} onClick={submitCapture}>Добавить</Button></section>
      <div className="live-desk__layout">
        <section className="live-desk__scenes"><div className="campaign-live-session__current"><span>Текущая сцена</span><h2>{currentScene?.title ?? 'Свободная игра'}</h2><p>{currentScene?.purpose || campaign.firstSessionOpening}</p></div><div className="campaign-live-session__plan"><span className="panel-kicker">План сессии</span>{campaign.firstSessionScenes.map((scene, index) => <button key={scene.id} className={scene.id === currentScene?.id ? 'active' : ''} disabled={completed} onClick={() => persist({ ...campaign, firstSessionCurrentSceneId: scene.id })}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{scene.title}</strong><small>{scene.purpose}</small></div>{scene.id === currentScene?.id && <Icon name="play" size={15} />}</button>)}</div></section>
        <section className="live-desk__work"><nav aria-label="Инструменты игровой сессии">{([['context', 'Подборка', linked.length], ['flows', 'Потоки', flows.length], ['clocks', 'Часы', campaign.clocks.length], ['secrets', 'Секреты', campaign.secrets.length]] as const).map(([value, label, count]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}<span>{count}</span></button>)}</nav>
          {tab === 'context' && (linked.length ? <div className="live-desk__context">{linked.map(({ item, entity }) => <article key={item.id}><div><span className="panel-kicker">{entity!.type} · {item.role || 'без роли'}</span><h3>{entity!.name}</h3><p>{item.note || entity!.description || 'Без заметки'}</p>{item.alternative && <small>Альтернатива: {item.alternative}</small>}</div><Select aria-label={`Статус ${entity!.name}`} value={item.status} disabled={completed} onChange={(event) => saveItemStatus(item.id, event.target.value as LocalSessionItem['status'])}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></article>)}</div> : <EmptyState icon="library" title="Подборка пуста" hint="Вернитесь в подготовку и добавьте записи из библиотеки." />)}
          {tab === 'flows' && (flows.length ? <div className="live-desk__flows">{flows.map((flow) => <article key={flow.id}><strong>{itemName(flow.fromItemId)}</strong><span><Icon name="arrow-right" size={15} /> {flow.condition || 'далее'} <Icon name="arrow-right" size={15} /></span><strong>{itemName(flow.toItemId)}</strong></article>)}</div> : <EmptyState icon="waypoints" title="Потоков пока нет" hint="Свяжите элементы в подготовке — здесь они станут быстрой картой переходов." />)}
          {tab === 'clocks' && (campaign.clocks.length ? <div className="live-desk__clocks">{campaign.clocks.map((clock) => <article key={clock.id}><div className="row"><div><span className="panel-kicker">{clock.kind}</span><h3>{clock.title}</h3></div><strong>{clock.value}/{clock.segments}</strong></div><div className="target-clock__track"><span style={{ width: `${clock.value / clock.segments * 100}%` }} /></div><p>{clock.trigger || clock.advanceCondition || 'Условие не задано'}</p><div className="live-desk__clock-actions"><input value={clockReasons[clock.id] ?? ''} disabled={completed} aria-label={`Причина изменения часов ${clock.title}`} placeholder="Почему изменились часы?" onChange={(event) => setClockReasons((current) => ({ ...current, [clock.id]: event.target.value }))} /><Button size="sm" disabled={completed || !clockReasons[clock.id]?.trim() || clock.value <= 0} onClick={() => moveClock(clock.id, -1)}>−1</Button><Button size="sm" variant="primary" disabled={completed || !clockReasons[clock.id]?.trim() || clock.value >= clock.segments} onClick={() => moveClock(clock.id, 1)}>+1</Button></div></article>)}</div> : <EmptyState icon="circle" title="Часов пока нет" hint="Создайте часы на пульте кампании." />)}
          {tab === 'secrets' && (campaign.secrets.length ? <div className="live-desk__secrets">{campaign.secrets.map((secret) => <article key={secret.id}><div><span className="panel-kicker">{secret.status === 'hidden' ? 'Скрыто' : 'Раскрытие изменено'}</span><h3>{secret.title}</h3><p>{secret.truth || secret.revealCondition || 'Формулировка пока не задана'}</p><small>{secret.recipients ? `Кому: ${secret.recipients}` : 'Получатели не выбраны'}</small></div><Select aria-label={`Раскрытие секрета ${secret.title}`} value={secret.status} disabled={completed} onChange={(event) => persist({ ...campaign, secrets: campaign.secrets.map((item) => item.id === secret.id ? { ...item, status: event.target.value as typeof item.status } : item) })}><option value="hidden">Скрыт</option><option value="partial">Частично</option><option value="selected">Выбранным</option><option value="everyone">Всем</option><option value="disproved">Опровергнут</option><option value="obsolete">Устарел</option></Select></article>)}</div> : <EmptyState icon="shield" title="Секретов пока нет" hint="Добавьте секрет на пульте или быстрым вводом." />)}
        </section>
        <aside className="live-desk__journal"><div className="panel-heading"><div><span className="panel-kicker">Хронология</span><h2>Журнал</h2></div><span className="panel-state">{campaign.firstSessionLog.length}</span></div><ol>{[...campaign.firstSessionLog].reverse().map((entry) => <li key={entry.id}><time>{new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time><p>{entry.text}</p></li>)}</ol>{campaign.firstSessionStatus === 'active' && <Button block tone="danger" icon="check" onClick={() => persist({ ...campaign, firstSessionStatus: 'completed' })}>Завершить сессию</Button>}</aside>
      </div>
    </>}
  </main>
}
