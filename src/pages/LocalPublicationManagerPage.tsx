import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Icon } from '../ds'
import { localPublicationDemo } from '../fixtures/localDemoRuntime'
import type { PublicationManagerSnapshot, StoredPublicationItem } from '../storage/publicationManager'

const STATE_TONE: Record<StoredPublicationItem['state'], 'neutral' | 'accent' | 'success' | 'danger' | 'warning'> = {
  draft: 'neutral', ready: 'accent', blocked: 'warning', succeeded: 'success', failed: 'danger',
}

function entityLabel(item: StoredPublicationItem) {
  return item.entityId === 'entity-silver-fox' ? 'Серебряный Лис' : item.entityId === 'entity-red-moon-rumor' ? 'Красная луна собирает долги' : item.entityId
}

export function LocalPublicationManagerPage() {
  const demo = useMemo(() => localPublicationDemo, [])
  const [snapshot, setSnapshot] = useState<PublicationManagerSnapshot | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [inspected, setInspected] = useState<StoredPublicationItem | null>(null)
  const [sendPrompt, setSendPrompt] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = useCallback(() => demo.snapshot().then(setSnapshot), [demo])
  useEffect(() => { void reload().catch((reason) => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить очередь публикаций')) }, [reload])
  useEffect(() => { if (!sendPrompt) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSendPrompt(false) }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [sendPrompt])

  const run = async (work: () => Promise<PublicationManagerSnapshot>, success: string) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const next = await work()
      setSnapshot(next)
      setSelected([])
      setInspected((current) => current ? [...next.active, ...next.history].find((item) => item.id === current.id) ?? null : null)
      setNotice(success)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось выполнить действие с публикацией')
    } finally {
      setBusy(false)
    }
  }

  if (!snapshot) return <main className="publication-manager"><p className="muted">Загружаем очередь публикаций…</p></main>
  const selectedItems = snapshot.active.filter((item) => selected.includes(item.id))
  const readyToConfirm = selectedItems.filter((item) => item.state === 'ready' && !item.confirmedAt)
  const failedToRetry = selectedItems.filter((item) => item.state === 'failed')
  const confirmed = snapshot.active.filter((item) => item.state === 'ready' && item.confirmedAt)

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  return (
    <main className="publication-manager">
      <header className="publication-manager__topbar">
        <div className="row target-demo-links"><Link to="/demo/campaign" className="row muted"><Icon name="layout-dashboard" size={16} /> Кампания</Link><Link to="/demo/library" className="row muted"><Icon name="library" size={16} /> Библиотека</Link></div>
        <Badge tone="neutral" dot>Только симуляция · тестовая цель</Badge>
      </header>

      <section className="publication-manager__heading">
        <div><span className="panel-kicker">Пространство Лунного порта</span><h1>Публикации</h1><p>Проверьте каждое изменение перед явной отправкой.</p></div>
        <div className="publication-manager__summary"><strong>{snapshot.active.length}</strong><span>активных операций</span><strong>{snapshot.history.length}</strong><span>завершено</span></div>
      </section>

      {error && <p className="local-session-error" role="alert">{error}</p>}
      {notice && <p className="publication-manager__notice" role="status"><Icon name="check" size={16} /> {notice}</p>}

      <section className="publication-manager__workflow" aria-label="Этапы публикации">
        <div className={`publication-step ${snapshot.counts.draft ? 'current' : 'done'}`}><span>1</span><div><strong>Предпросмотр</strong><small>{snapshot.counts.draft ? `${snapshot.counts.draft} черновика` : 'Возможности проверены'}</small></div></div>
        <div className={`publication-step ${snapshot.counts.ready ? 'current' : snapshot.counts.draft ? '' : 'done'}`}><span>2</span><div><strong>Подтверждение</strong><small>{confirmed.length ? `${confirmed.length} подтверждено` : `${snapshot.counts.ready} готово`}</small></div></div>
        <div className={`publication-step ${confirmed.length ? 'current' : ''}`}><span>3</span><div><strong>Тестовая отправка</strong><small>Только вручную</small></div></div>
      </section>

      <div className="publication-manager__actions">
        <Button icon="search" disabled={!snapshot.counts.draft || busy} onClick={() => void run(() => demo.preview(), 'Предпросмотр завершён. Ничего не отправлено.')}>Проверить черновики</Button>
        <Button variant="primary" icon="check" disabled={!readyToConfirm.length || busy} onClick={() => void run(() => demo.confirm(readyToConfirm.map((item) => item.id)), `Подтверждено операций: ${readyToConfirm.length}.`)}>Подтвердить выбранное</Button>
        <Button tone="danger" icon="refresh-cw" disabled={!failedToRetry.length || busy} onClick={() => void run(() => demo.retry(failedToRetry.map((item) => item.id)), `Операций возвращено к повторной проверке: ${failedToRetry.length}.`)}>Повторить выбранное</Button>
        <Button variant="primary" tone="success" icon="upload" disabled={!confirmed.length || busy} onClick={() => setSendPrompt(true)}>Отправить подтверждённые ({confirmed.length})</Button>
      </div>

      <div className={`publication-manager__workspace ${inspected ? 'has-inspector' : ''}`}>
        <section>
          <Card className="publication-destination" padding="0">
            <header><div><span className="panel-kicker">Тестовая цель Lovegame</span><h2>Кампания «Лунный порт»</h2></div><Badge tone="accent">{demo.connection.label}</Badge></header>
            <div className="publication-table" aria-label="Активные операции публикации">
              <div className="publication-row publication-row--head"><span /><span>Сущность</span><span>Операция</span><span>Изменение</span><span>Состояние</span></div>
              {snapshot.active.map((item) => {
                const canSelect = (item.state === 'ready' && !item.confirmedAt) || item.state === 'failed'
                return (
                  <button key={item.id} className={`publication-row ${inspected?.id === item.id ? 'is-inspected' : ''}`} onClick={() => setInspected(item)}>
                    <span onClick={(event) => event.stopPropagation()}>{canSelect ? <input aria-label={`Выбрать: ${entityLabel(item)}`} type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} /> : null}</span>
                    <span data-label="Сущность"><strong>{entityLabel(item)}</strong><small>{item.entityType}</small></span>
                    <span data-label="Операция">{item.operation}</span>
                    <span data-label="Изменение" className="mb-data">{Object.keys(item.patch).join(', ')}</span>
                    <span data-label="Состояние"><Badge tone={STATE_TONE[item.state]} size="sm" dot>{item.confirmedAt && item.state === 'ready' ? 'подтверждено' : item.state}</Badge></span>
                  </button>
                )
              })}
            </div>
          </Card>

          <button className="publication-history-toggle" onClick={() => setShowHistory((value) => !value)}><span><Icon name="history" size={16} /> История</span><span>{snapshot.history.length} {showHistory ? '−' : '+'}</span></button>
          {showHistory && <div className="publication-history">{snapshot.history.length ? snapshot.history.map((item) => <div key={item.id}><span>{entityLabel(item)} · {item.operation}</span><Badge tone="success" size="sm">успешно</Badge></div>) : <p className="muted">Завершённых тестовых операций пока нет.</p>}</div>}
        </section>

        {inspected && (
          <aside className="publication-inspector">
            <button className="target-inspector__close" aria-label="Закрыть инспектор" onClick={() => setInspected(null)}>×</button>
            <span className="panel-kicker">Изменения операции</span>
            <h2>{entityLabel(inspected)}</h2>
            <div className="target-inspector__origins"><Badge tone={STATE_TONE[inspected.state]}>{inspected.state}</Badge><Badge tone="accent">Тестовый Lovegame</Badge></div>
            <dl className="target-inspector__facts"><dt>Операция</dt><dd>{inspected.operation}</dd><dt>Тип сущности</dt><dd>{inspected.entityType}</dd><dt>Назначение</dt><dd>Лунный порт</dd></dl>
            <div className="publication-diff">
              <div className="publication-diff__head"><span>Поле</span><span>Новое значение</span></div>
              {Object.entries(inspected.patch).map(([field, value]) => <div key={field}><code>{field}</code><strong>{JSON.stringify(value)}</strong></div>)}
            </div>
            {inspected.error && <div className="publication-inspector__error"><strong>Требует внимания</strong><p>{inspected.error}</p></div>}
            <p className="muted target-inspector__note">Инспектор показывает симуляцию. Внешние данные не изменяются.</p>
          </aside>
        )}
      </div>

      {sendPrompt && (
        <div className="publication-send-scrim" role="presentation" onMouseDown={() => setSendPrompt(false)}>
          <section className="publication-send-confirm" role="dialog" aria-modal="true" aria-labelledby="fake-send-title" onMouseDown={(event) => event.stopPropagation()}>
            <Badge tone="warning" icon="triangle-alert">Граница симуляции</Badge>
            <h2 id="fake-send-title">Запустить тестовую публикацию?</h2>
            <p>Подтверждённых операций: {confirmed.length}. Они будут переданы детерминированному тестовому адаптеру. Одна настроенная операция завершится ошибкой для проверки частичного результата.</p>
            <div className="publication-send-list">{confirmed.map((item) => <span key={item.id}>{entityLabel(item)} · {item.operation}</span>)}</div>
            <div className="row"><Button variant="primary" tone="success" icon="upload" disabled={busy} onClick={() => { setSendPrompt(false); void run(() => demo.execute(), 'Тестовая отправка завершена. Успешные операции перенесены в историю, ошибки остались активными.') }}>Запустить тестовую отправку</Button><Button variant="ghost" onClick={() => setSendPrompt(false)}>Отмена</Button></div>
          </section>
        </div>
      )}

      <p className="local-session-footnote">С этого экрана не уходит ни одного внешнего запроса. Перезагрузка сбросит очередь.</p>
    </main>
  )
}
