import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Icon, Select } from '../ds'
import { localConductorDemo } from '../fixtures/localDemoRuntime'
import type { ConductorLogKind, ConductorSnapshot } from '../fixtures/localConductorDemo'

const LOG_LABEL: Record<ConductorLogKind, string> = { scene: 'Scene', clock: 'Clock', secret: 'Secret', note: 'Note', consequence: 'Consequence' }

export function LocalConductorPage() {
  const demo = useMemo(() => localConductorDemo, [])
  const [state, setState] = useState<ConductorSnapshot>(() => demo.read())
  const [text, setText] = useState('')
  const [kind, setKind] = useState<ConductorLogKind>('note')
  const [confirmClose, setConfirmClose] = useState(false)
  const scene = state.scenes[state.currentScene]
  const disabled = state.status === 'closed'

  const capture = () => {
    if (!text.trim()) return
    setState(demo.addLog(kind, text)); setText('')
  }

  return <main className="conductor">
    <header className="conductor__topbar">
      <div className="conductor__nav"><Link to="/demo/session-board"><Icon name="arrow-left" size={15} /> Scene board</Link><span>Moon Port · Session 01</span></div>
      <div className="conductor__controls"><Badge tone={state.status === 'running' ? 'success' : state.status === 'paused' ? 'warning' : 'neutral'} dot>{state.status}</Badge><Button size="sm" icon={state.status === 'paused' ? 'clapperboard' : 'minus'} disabled={disabled} onClick={() => setState(demo.togglePause())}>{state.status === 'paused' ? 'Resume' : 'Pause'}</Button><Button size="sm" variant="ghost" icon="x" disabled={disabled} onClick={() => setConfirmClose(true)}>End session</Button></div>
    </header>

    <section className="conductor__hero">
      <div><span className="panel-kicker">Live conductor · fake workspace</span><h1>{scene.title}</h1><p>{scene.purpose}</p></div>
      <div className="conductor__progress"><span>Scene {state.currentScene + 1} of {state.scenes.length}</span><div>{state.scenes.map((item, index) => <i key={item.id} className={index <= state.currentScene ? 'is-active' : ''} />)}</div><small>{state.elapsedMinutes} min elapsed</small></div>
    </section>

    <div className="conductor__grid">
      <section className="conductor__stage">
        <article className="conductor__prompt"><span className="panel-kicker">GM prompt</span><blockquote>{scene.prompt}</blockquote><div>{scene.cast.map((name) => <button key={name}>{name}</button>)}</div></article>
        <div className="conductor__quicklog"><Select aria-label="Log kind" value={kind} disabled={disabled} onChange={(event) => setKind(event.target.value as ConductorLogKind)}>{(['note', 'consequence', 'scene'] as ConductorLogKind[]).map((value) => <option key={value} value={value}>{LOG_LABEL[value]}</option>)}</Select><input id="conductor-log" name="conductor-log" value={text} disabled={disabled} placeholder="Record what became true…" onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') capture() }} /><Button variant="primary" icon="plus" disabled={disabled || !text.trim()} onClick={capture}>Log</Button></div>
        <div className="conductor__advance"><div><span className="panel-kicker">Up next</span><strong>{state.scenes[state.currentScene + 1]?.title ?? 'Review and consequences'}</strong></div>{state.currentScene < state.scenes.length - 1 ? <Button variant="primary" icon="arrow-right" disabled={disabled} onClick={() => setState(demo.advanceScene())}>Advance scene</Button> : <Button variant="primary" icon="check" disabled={disabled} onClick={() => setConfirmClose(true)}>Finish play</Button>}</div>
      </section>

      <aside className="conductor__rail">
        <article className="conductor__clock"><div className="panel-heading"><div><span className="panel-kicker">Pressure</span><h2>{state.clock.title}</h2></div><strong>{state.clock.value}/{state.clock.max}</strong></div><div className="conductor__clock-dial">{Array.from({ length: state.clock.max }, (_, index) => <i key={index} className={index < state.clock.value ? 'is-filled' : ''} />)}</div><div className="conductor__clock-actions"><Button size="sm" icon="minus" disabled={disabled || state.clock.value === 0} onClick={() => setState(demo.tickClock(-1))}>Reduce</Button><Button size="sm" variant="primary" icon="plus" disabled={disabled || state.clock.value === state.clock.max} onClick={() => setState(demo.tickClock(1))}>Advance</Button></div></article>
        <article className={`conductor__secret${state.secret.revealed ? ' is-revealed' : ''}`}><span className="panel-kicker">Master only</span><h2>{state.secret.title}</h2><p>{state.secret.revealed ? state.secret.truth : 'Truth stays concealed until it lands at the table.'}</p><Button size="sm" icon={state.secret.revealed ? 'check' : 'shield'} disabled={disabled || state.secret.revealed} onClick={() => setState(demo.revealSecret())}>{state.secret.revealed ? 'Revealed' : 'Reveal and log'}</Button></article>
      </aside>

      <section className="conductor__log"><div className="panel-heading"><div><span className="panel-kicker">Factual record</span><h2>Live log</h2></div><span className="panel-state">{state.log.length} entries</span></div><ol>{[...state.log].reverse().map((entry) => <li key={entry.id}><time>{entry.at}</time><Badge tone={entry.kind === 'secret' ? 'warning' : entry.kind === 'clock' ? 'accent' : 'neutral'} size="sm">{LOG_LABEL[entry.kind]}</Badge><span>{entry.text}</span></li>)}</ol></section>
    </div>

    {confirmClose && <div className="conductor__scrim" role="presentation"><section className="conductor__modal" role="dialog" aria-modal="true" aria-labelledby="end-session-title"><span className="panel-kicker">Explicit transition</span><h2 id="end-session-title">End live play?</h2><p>The factual log will lock and the review workspace will become the next step.</p><div><Button onClick={() => setConfirmClose(false)}>Keep running</Button><Button variant="primary" icon="check" onClick={() => { setState(demo.close()); setConfirmClose(false) }}>End and prepare review</Button></div></section></div>}
    {disabled && <div className="conductor__closed"><span><Icon name="check" size={18} /> Live play closed. The factual log is locked.</span><Link to="/demo/session">Open review <Icon name="arrow-right" size={15} /></Link></div>}
  </main>
}
