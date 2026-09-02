import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Icon, Select } from '../ds'
import { localConductorDemo } from '../fixtures/localDemoRuntime'
import type { ConductorLogKind, ConductorSnapshot } from '../fixtures/localConductorDemo'

const LOG_LABEL: Record<ConductorLogKind, string> = { scene: 'Сцена', clock: 'Часы', secret: 'Секрет', note: 'Заметка', consequence: 'Последствие' }

export function LocalConductorPage() {
  const demo = useMemo(() => localConductorDemo, [])
  const [state, setState] = useState<ConductorSnapshot>(() => demo.read())
  const [text, setText] = useState('')
  const [kind, setKind] = useState<ConductorLogKind>('note')
  const [confirmClose, setConfirmClose] = useState(false)
  const scene = state.scenes[state.currentScene]
  const disabled = state.status === 'closed'
  useEffect(() => { if (!confirmClose) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setConfirmClose(false) }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [confirmClose])

  const capture = () => {
    if (!text.trim()) return
    setState(demo.addLog(kind, text)); setText('')
  }

  return <main className="conductor">
    <header className="conductor__topbar">
      <div className="conductor__nav"><Link to="/demo/session-board"><Icon name="arrow-left" size={15} /> Доска сцен</Link><span>Лунный порт · Сессия 01</span></div>
      <div className="conductor__controls"><Badge tone={state.status === 'running' ? 'success' : state.status === 'paused' ? 'warning' : 'neutral'} dot>{state.status === 'running' ? 'идёт игра' : state.status === 'paused' ? 'пауза' : 'завершена'}</Badge><Button size="sm" icon={state.status === 'paused' ? 'clapperboard' : 'minus'} disabled={disabled} onClick={() => setState(demo.togglePause())}>{state.status === 'paused' ? 'Продолжить' : 'Пауза'}</Button><Button size="sm" variant="ghost" icon="x" disabled={disabled} onClick={() => setConfirmClose(true)}>Завершить</Button></div>
    </header>

    <section className="conductor__hero">
      <div><span className="panel-kicker">Режим проведения · тестовые данные</span><h1>{scene.title}</h1><p>{scene.purpose}</p></div>
      <div className="conductor__progress"><span>Сцена {state.currentScene + 1} из {state.scenes.length}</span><div>{state.scenes.map((item, index) => <i key={item.id} className={index <= state.currentScene ? 'is-active' : ''} />)}</div><small>Прошло {state.elapsedMinutes} мин</small></div>
    </section>

    <div className="conductor__grid">
      <section className="conductor__stage">
        <article className="conductor__prompt"><span className="panel-kicker">Подсказка ведущему</span><blockquote>{scene.prompt}</blockquote><div>{scene.cast.map((name) => <button key={name}>{name}</button>)}</div></article>
        <div className="conductor__quicklog"><Select aria-label="Тип записи" value={kind} disabled={disabled} onChange={(event) => setKind(event.target.value as ConductorLogKind)}>{(['note', 'consequence', 'scene'] as ConductorLogKind[]).map((value) => <option key={value} value={value}>{LOG_LABEL[value]}</option>)}</Select><input id="conductor-log" name="conductor-log" value={text} disabled={disabled} placeholder="Запишите, что стало правдой…" onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') capture() }} /><Button variant="primary" icon="plus" disabled={disabled || !text.trim()} onClick={capture}>Записать</Button></div>
        <div className="conductor__advance"><div><span className="panel-kicker">Дальше</span><strong>{state.scenes[state.currentScene + 1]?.title ?? 'Разбор и последствия'}</strong></div>{state.currentScene < state.scenes.length - 1 ? <Button variant="primary" icon="arrow-right" disabled={disabled} onClick={() => setState(demo.advanceScene())}>Следующая сцена</Button> : <Button variant="primary" icon="check" disabled={disabled} onClick={() => setConfirmClose(true)}>Завершить игру</Button>}</div>
      </section>

      <aside className="conductor__rail">
        <article className="conductor__clock"><div className="panel-heading"><div><span className="panel-kicker">Давление</span><h2>{state.clock.title}</h2></div><strong>{state.clock.value}/{state.clock.max}</strong></div><div className="conductor__clock-dial">{Array.from({ length: state.clock.max }, (_, index) => <i key={index} className={index < state.clock.value ? 'is-filled' : ''} />)}</div><div className="conductor__clock-actions"><Button size="sm" icon="minus" disabled={disabled || state.clock.value === 0} onClick={() => setState(demo.tickClock(-1))}>Уменьшить</Button><Button size="sm" variant="primary" icon="plus" disabled={disabled || state.clock.value === state.clock.max} onClick={() => setState(demo.tickClock(1))}>Продвинуть</Button></div></article>
        <article className={`conductor__secret${state.secret.revealed ? ' is-revealed' : ''}`}><span className="panel-kicker">Только ведущим</span><h2>{state.secret.title}</h2><p>{state.secret.revealed ? state.secret.truth : 'Правда скрыта, пока не прозвучит за столом.'}</p><Button size="sm" icon={state.secret.revealed ? 'check' : 'shield'} disabled={disabled || state.secret.revealed} onClick={() => setState(demo.revealSecret())}>{state.secret.revealed ? 'Раскрыто' : 'Раскрыть и записать'}</Button></article>
      </aside>

      <section className="conductor__log"><div className="panel-heading"><div><span className="panel-kicker">Фактическая запись</span><h2>Журнал игры</h2></div><span className="panel-state">{state.log.length} записей</span></div><ol>{[...state.log].reverse().map((entry) => <li key={entry.id}><time>{entry.at}</time><Badge tone={entry.kind === 'secret' ? 'warning' : entry.kind === 'clock' ? 'accent' : 'neutral'} size="sm">{LOG_LABEL[entry.kind]}</Badge><span>{entry.text}</span></li>)}</ol></section>
    </div>

    {confirmClose && <div className="conductor__scrim" role="presentation"><section className="conductor__modal" role="dialog" aria-modal="true" aria-labelledby="end-session-title"><span className="panel-kicker">Явный переход</span><h2 id="end-session-title">Завершить игру?</h2><p>Фактический журнал заблокируется, следующим шагом станет разбор сессии.</p><div><Button onClick={() => setConfirmClose(false)}>Продолжить игру</Button><Button variant="primary" icon="check" onClick={() => { setState(demo.close()); setConfirmClose(false) }}>Завершить и перейти к разбору</Button></div></section></div>}
    {disabled && <div className="conductor__closed"><span><Icon name="check" size={18} /> Игра завершена. Фактический журнал заблокирован.</span><Link to="/demo/review">Открыть разбор <Icon name="arrow-right" size={15} /></Link></div>}
  </main>
}
