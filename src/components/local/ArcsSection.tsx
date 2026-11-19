import { useState } from 'react'
import { Badge, Button, EmptyState, Icon, Select, TextField } from '../../ds'
import { arcNeedsReason, newArc } from '../../local/domain'
import { ARC_STATUS } from '../../local/labels'
import type { LocalStoryArc } from '../../local/types'
import { Editor, type SectionProps } from './shared'
import { arcRemovalImpact, removeArc } from '../../local/removal'
import { useConfirm } from '../useConfirm'
import { useActing } from '../../local/actingContext'
import { removeWithUndo } from '../toast'


const ARC_COLUMNS: Array<{ status: LocalStoryArc['status']; hint: string }> = [
  { status: 'planned', hint: 'Линии, которые ещё не вышли на сцену' },
  { status: 'active', hint: 'То, что прямо сейчас меняет мир' },
  { status: 'paused', hint: 'Отложены, но могут вернуться' },
  { status: 'resolved', hint: 'Линии с зафиксированным исходом' },
  { status: 'cancelled', hint: 'Сняты с истории, причина сохранена' },
]

type Draft = Omit<LocalStoryArc, 'id'>

export function ArcsSection({ campaign, persist }: SectionProps) {
  const arcs = campaign.storyArcs
  const [editor, setEditor] = useState<LocalStoryArc | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(newArc())
  const acting = useActing(campaign)
  const openEditor = (arc: LocalStoryArc | 'new') => { setEditor(arc); setOtherOwner(false); const { id: _id, ...rest } = arc === 'new' ? newArc({ ownerRef: acting.master ? { kind: 'master', id: acting.master.id } : undefined }) : arc; setDraft(rest) }
  // Owner (ТЗ-3, этап 17, В9б): a master or a player by link, or free text under «Другое…».
  const [otherOwner, setOtherOwner] = useState(false)
  const ownerValue = draft.ownerRef ? `${draft.ownerRef.kind}:${draft.ownerRef.id}` : draft.owner.trim() || otherOwner ? 'other' : ''
  const setOwner = (value: string) => {
    const [kind, id] = value.split(':')
    setOtherOwner(value === 'other')
    if ((kind === 'master' || kind === 'player') && id) setDraft({ ...draft, ownerRef: { kind, id }, owner: '' })
    else { const { ownerRef: _gone, ...rest } = draft; setDraft({ ...rest, owner: value === 'other' ? draft.owner : '' }) }
  }
  const reasonMissing = arcNeedsReason(draft.status) && !draft.statusReason.trim()
  const save = () => {
    if (!draft.title.trim() || reasonMissing || !editor) return
    const arc: LocalStoryArc = { ...draft, title: draft.title.trim(), direction: draft.direction.trim(), stakes: draft.stakes.trim(), owner: draft.ownerRef ? '' : draft.owner.trim(), statusReason: arcNeedsReason(draft.status) ? draft.statusReason.trim() : '', progress: Math.max(0, Math.min(100, draft.progress)), id: editor === 'new' ? `arc-${crypto.randomUUID()}` : editor.id }
    persist({ ...campaign, storyArcs: editor === 'new' ? [...arcs, arc] : arcs.map((item) => item.id === arc.id ? arc : item) })
    setEditor(null)
  }
  const confirm = useConfirm()
  /** Linked to sessions or clocks — ask and list them; otherwise at once, with «Отменить». */
  const remove = (arc: LocalStoryArc) => {
    const impact = arcRemovalImpact(campaign, arc.id)
    const next = removeArc(campaign, arc.id)
    if (!impact.length) { removeWithUndo(persist, campaign, next, `Линия «${arc.title}»`); setEditor(null); return }
    confirm({
      title: `Удалить линию «${arc.title}»?`,
      message: 'Вместе с ней:',
      items: impact,
      confirmLabel: 'Удалить',
      onConfirm: () => { persist(next); setEditor(null) },
    })
  }
  const visibleColumns = ARC_COLUMNS.filter((column) => column.status !== 'paused' && column.status !== 'cancelled' || arcs.some((arc) => arc.status === column.status))

  return <>
    <section className="campaign-section campaign-arcs"><header className="panel-heading"><div><span className="panel-kicker">Драматургическая карта</span><h2>Сюжетные линии</h2><p>Направление истории, ставки и текущее состояние — без жёсткого сценария.</p></div><Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Новая линия</Button></header><div className="campaign-arcs__summary"><span><strong>{arcs.filter((arc) => arc.status === 'active').length}</strong> в игре</span><span><strong>{arcs.filter((arc) => arc.status === 'paused').length}</strong> на паузе</span><span><strong>{arcs.filter((arc) => arc.progress >= 70 && arc.status === 'active').length}</strong> близко к развязке</span><span><strong>{arcs.length}</strong> всего</span></div>{arcs.length ? <div className="campaign-arcs__board" style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(0, 1fr))` }}>{visibleColumns.map((column) => { const items = arcs.filter((arc) => arc.status === column.status); return <section key={column.status} data-status={column.status} aria-label={ARC_STATUS[column.status]}><header><div><h3>{ARC_STATUS[column.status]}</h3><p>{column.hint}</p></div><span>{items.length}</span></header><div>{items.map((arc) => <article key={arc.id}><div className="campaign-arc__title"><Icon name="waypoints" size={17} /><h4>{arc.title}</h4><Button size="sm" icon="pencil" aria-label={`Редактировать линию: ${arc.title}`} onClick={() => openEditor(arc)} /></div><div className="row campaign-arc__tags"><Badge size="sm" tone={arc.mode === 'foreground' ? 'accent' : 'neutral'}>{arc.mode === 'foreground' ? 'Передний план' : 'Фон'}</Badge>{arc.owner && <Badge size="sm" tone="neutral" icon="users">{arc.owner}</Badge>}</div><p>{arc.direction || 'Направление пока не задано.'}</p>{arc.statusReason && <p className="campaign-arc__reason"><strong>{ARC_STATUS[arc.status]}:</strong> {arc.statusReason}</p>}<div className="campaign-arc__stakes"><span>Ставки</span><strong>{arc.stakes || 'Не определены'}</strong></div><div className="campaign-arc__progress"><div><span>Прогресс</span><strong>{arc.progress}%</strong></div><i><span style={{ width: `${arc.progress}%` }} /></i></div></article>)}</div></section> })}</div> : <EmptyState icon="waypoints" title="Сюжетных линий пока нет" hint="Добавьте первое развивающееся противоречие: куда оно движется и что поставлено на карту." action={<Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Создать первую линию</Button>} />}</section>
    {editor && <Editor title={editor === 'new' ? 'Новая сюжетная линия' : 'Редактировать сюжетную линию'} close={() => setEditor(null)} draft={draft}>
      <TextField
        label="Название"
        id="arc-title"
        autoFocus
        value={draft.title}
        placeholder="Договор с красной луной"
        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
      />
      <TextField
        label="Куда движется линия"
        multiline
        rows={3}
        id="arc-direction"
        value={draft.direction}
        placeholder="Что произойдёт без вмешательства героев?"
        onChange={(event) => setDraft({ ...draft, direction: event.target.value })}
      />
      <TextField
        label="Ставки"
        multiline
        rows={2}
        id="arc-stakes"
        value={draft.stakes}
        placeholder="Что можно потерять или приобрести?"
        onChange={(event) => setDraft({ ...draft, stakes: event.target.value })}
      />
      <div className="campaign-arc-form__row">
        <Select
          label="Владелец линии"
          id="arc-owner"
          value={ownerValue}
          onChange={(event) => setOwner(event.target.value)}
        >
          <option value="">Не задан</option>
          <optgroup label="Мастера">
            {campaign.masters.map((master) => <option key={master.id} value={`master:${master.id}`}>{master.name}</option>)}
          </optgroup>
          {campaign.players.length > 0 && <optgroup label="Игроки">
            {campaign.players.map((player) => <option key={player.id} value={`player:${player.id}`}>{player.name}</option>)}
          </optgroup>}
          <option value="other">Другое…</option>
        </Select>
        {ownerValue === 'other' && <TextField
          label="Кто ведёт (не мастер и не игрок)"
          id="arc-owner-other"
          value={draft.owner}
          placeholder="NPC, фракция…"
          onChange={(event) => setDraft({ ...draft, owner: event.target.value })}
        />}
        <Select
          label="Режим"
          id="arc-mode"
          value={draft.mode}
          onChange={(event) => setDraft({ ...draft, mode: event.target.value as LocalStoryArc['mode'] })}
        >
          <option value="foreground">Передний план</option>
          <option value="background">Фон</option>
        </Select>
      </div>
      <div className="campaign-arc-form__row">
        <Select
          label="Состояние"
          id="arc-status"
          value={draft.status}
          onChange={(event) => setDraft({ ...draft, status: event.target.value as LocalStoryArc['status'] })}
        >
          {Object.entries(ARC_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <label htmlFor="arc-progress">Прогресс · {draft.progress}%<input id="arc-progress" type="range" min="0" max="100" step="10" value={draft.progress} onChange={(event) => setDraft({ ...draft, progress: Number(event.target.value) })} /></label>
      </div>
      {arcNeedsReason(draft.status) && (
        <div>
          <TextField
            label={`Почему линия ${draft.status === 'paused' ? 'приостановлена' : 'отменена'}`}
            multiline
            rows={2}
            id="arc-reason"
            value={draft.statusReason}
            onChange={(event) => setDraft({ ...draft, statusReason: event.target.value })}
          />
          {reasonMissing && <small className="local-session-error">Укажите причину — она сохранится на карточке.</small>}
        </div>
      )}
      <footer>
        {editor !== 'new' && (
          <Button tone="danger" onClick={() => remove(editor)}>
            Удалить
          </Button>
        )}
        <Button onClick={() => setEditor(null)}>Отмена</Button><Button variant="primary" icon="check" disabled={!draft.title.trim() || reasonMissing} onClick={save}>Сохранить</Button></footer>
    </Editor>}
  </>
}
