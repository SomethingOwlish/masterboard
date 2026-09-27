import { useState } from 'react'
import { Badge, Button, EmptyState, Icon } from '../../ds'
import { arcNeedsReason, newArc } from '../../local/domain'
import { ARC_STATUS } from '../../local/labels'
import type { LocalStoryArc } from '../../local/types'
import { Editor, type SectionProps } from './shared'


const ARC_COLUMNS: Array<{ status: LocalStoryArc['status']; label: string; hint: string }> = [
  { status: 'planned', label: 'Замысел', hint: 'Линии, которые ещё не вышли на сцену' },
  { status: 'active', label: 'В игре', hint: 'То, что прямо сейчас меняет мир' },
  { status: 'paused', label: 'На паузе', hint: 'Отложены, но могут вернуться' },
  { status: 'resolved', label: 'Завершено', hint: 'Линии с зафиксированным исходом' },
  { status: 'cancelled', label: 'Отменено', hint: 'Сняты с истории, причина сохранена' },
]

type Draft = Omit<LocalStoryArc, 'id'>

export function ArcsSection({ campaign, persist }: SectionProps) {
  const arcs = campaign.storyArcs
  const masters = [...campaign.masters.map((master) => master.name), ...campaign.players.map((player) => player.name)]
  const [editor, setEditor] = useState<LocalStoryArc | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(newArc())
  const openEditor = (arc: LocalStoryArc | 'new') => { setEditor(arc); const { id: _id, ...rest } = arc === 'new' ? newArc({ owner: masters[0] ?? '' }) : arc; setDraft(rest) }
  const reasonMissing = arcNeedsReason(draft.status) && !draft.statusReason.trim()
  const save = () => {
    if (!draft.title.trim() || reasonMissing || !editor) return
    const arc: LocalStoryArc = { ...draft, title: draft.title.trim(), direction: draft.direction.trim(), stakes: draft.stakes.trim(), owner: draft.owner.trim(), statusReason: arcNeedsReason(draft.status) ? draft.statusReason.trim() : '', progress: Math.max(0, Math.min(100, draft.progress)), id: editor === 'new' ? `arc-${crypto.randomUUID()}` : editor.id }
    persist({ ...campaign, storyArcs: editor === 'new' ? [...arcs, arc] : arcs.map((item) => item.id === arc.id ? arc : item) })
    setEditor(null)
  }
  const visibleColumns = ARC_COLUMNS.filter((column) => column.status !== 'paused' && column.status !== 'cancelled' || arcs.some((arc) => arc.status === column.status))

  return <>
    <section className="campaign-section campaign-arcs"><header className="panel-heading"><div><span className="panel-kicker">Драматургическая карта</span><h2>Сюжетные линии</h2><p>Направление истории, ставки и текущее состояние — без жёсткого сценария.</p></div><Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Новая линия</Button></header><div className="campaign-arcs__summary"><span><strong>{arcs.filter((arc) => arc.status === 'active').length}</strong> в игре</span><span><strong>{arcs.filter((arc) => arc.status === 'paused').length}</strong> на паузе</span><span><strong>{arcs.filter((arc) => arc.progress >= 70 && arc.status === 'active').length}</strong> близко к развязке</span><span><strong>{arcs.length}</strong> всего</span></div>{arcs.length ? <div className="campaign-arcs__board" style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(0, 1fr))` }}>{visibleColumns.map((column) => { const items = arcs.filter((arc) => arc.status === column.status); return <section key={column.status} data-status={column.status} aria-label={column.label}><header><div><h3>{column.label}</h3><p>{column.hint}</p></div><span>{items.length}</span></header><div>{items.map((arc) => <article key={arc.id}><div className="campaign-arc__title"><Icon name="waypoints" size={17} /><h4>{arc.title}</h4><Button size="sm" icon="pencil" aria-label={`Редактировать линию: ${arc.title}`} onClick={() => openEditor(arc)} /></div><div className="row campaign-arc__tags"><Badge size="sm" tone={arc.mode === 'foreground' ? 'accent' : 'neutral'}>{arc.mode === 'foreground' ? 'Передний план' : 'Фон'}</Badge>{arc.owner && <Badge size="sm" tone="neutral" icon="users">{arc.owner}</Badge>}</div><p>{arc.direction || 'Направление пока не задано.'}</p>{arc.statusReason && <p className="campaign-arc__reason"><strong>{ARC_STATUS[arc.status]}:</strong> {arc.statusReason}</p>}<div className="campaign-arc__stakes"><span>Ставки</span><strong>{arc.stakes || 'Не определены'}</strong></div><div className="campaign-arc__progress"><div><span>Прогресс</span><strong>{arc.progress}%</strong></div><i><span style={{ width: `${arc.progress}%` }} /></i></div></article>)}</div></section> })}</div> : <EmptyState icon="waypoints" title="Сюжетных линий пока нет" hint="Добавьте первое развивающееся противоречие: куда оно движется и что поставлено на карту." action={<Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Создать первую линию</Button>} />}</section>
    {editor && <Editor title={editor === 'new' ? 'Новая сюжетная линия' : 'Редактировать сюжетную линию'} close={() => setEditor(null)} draft={draft}>
      <label htmlFor="arc-title">Название<input id="arc-title" autoFocus value={draft.title} placeholder="Договор с красной луной" onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label htmlFor="arc-direction">Куда движется линия<textarea id="arc-direction" rows={3} value={draft.direction} placeholder="Что произойдёт без вмешательства героев?" onChange={(event) => setDraft({ ...draft, direction: event.target.value })} /></label>
      <label htmlFor="arc-stakes">Ставки<textarea id="arc-stakes" rows={2} value={draft.stakes} placeholder="Что можно потерять или приобрести?" onChange={(event) => setDraft({ ...draft, stakes: event.target.value })} /></label>
      <div className="campaign-arc-form__row">
        <label htmlFor="arc-owner">Владелец линии<input id="arc-owner" list="arc-owner-options" value={draft.owner} placeholder="Мастер или игрок" onChange={(event) => setDraft({ ...draft, owner: event.target.value })} /><datalist id="arc-owner-options">{masters.map((name) => <option key={name} value={name} />)}</datalist></label>
        <label htmlFor="arc-mode">Режим<select id="arc-mode" value={draft.mode} onChange={(event) => setDraft({ ...draft, mode: event.target.value as LocalStoryArc['mode'] })}><option value="foreground">Передний план</option><option value="background">Фон</option></select></label>
      </div>
      <div className="campaign-arc-form__row">
        <label htmlFor="arc-status">Состояние<select id="arc-status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as LocalStoryArc['status'] })}>{Object.entries(ARC_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label htmlFor="arc-progress">Прогресс · {draft.progress}%<input id="arc-progress" type="range" min="0" max="100" step="10" value={draft.progress} onChange={(event) => setDraft({ ...draft, progress: Number(event.target.value) })} /></label>
      </div>
      {arcNeedsReason(draft.status) && <label htmlFor="arc-reason">Почему линия {draft.status === 'paused' ? 'приостановлена' : 'отменена'}<textarea id="arc-reason" rows={2} value={draft.statusReason} onChange={(event) => setDraft({ ...draft, statusReason: event.target.value })} />{reasonMissing && <small className="local-session-error">Укажите причину — она сохранится на карточке.</small>}</label>}
      <footer>{editor !== 'new' && <Button tone="danger" onClick={() => { persist({ ...campaign, storyArcs: arcs.filter((item) => item.id !== editor.id), sessionRecords: campaign.sessionRecords.map((session) => ({ ...session, arcId: session.arcId === editor.id ? '' : session.arcId, backgroundArcIds: session.backgroundArcIds.filter((id) => id !== editor.id) })) }); setEditor(null) }}>Удалить</Button>}<Button onClick={() => setEditor(null)}>Отмена</Button><Button variant="primary" icon="check" disabled={!draft.title.trim() || reasonMissing} onClick={save}>Сохранить</Button></footer>
    </Editor>}
  </>
}
