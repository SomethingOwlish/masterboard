import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, EmptyState, Icon, Select } from '../ds'
import { newEntity, newSecret, toggleId } from '../local/domain'
import { blankSession, withLocalSessions } from '../local/normalize'
import type { LocalCampaignEntityType, LocalCampaignRecord, LocalSessionPlanItem, LocalSessionPlanKind, LocalSessionRecord } from '../local/types'
import { LivePanel } from './local/LivePanel'
import { ReviewWizard } from './local/ReviewWizard'
import { CampaignNav, Checklist, SessionModal as Modal, StorageBadge } from './local/shared'
import { ActingMasterSelect } from './local/ActingMasterSelect'
import { useActing } from '../local/actingContext'
import { useConfirm } from './useConfirm'
import { handOver, masterName, runSessionHint, sessionPlayers } from '../local/team'
import { PlanViews } from './local/plan/PlanViews'
import { type LinkedSource, type PlanApi, type PlanTarget } from './local/plan/planApi'
import { LibraryPicker, PlanAddPanel } from './local/plan/PlanAdd'
import { EntityEditor } from './local/EntityEditor'
import { moveItemTo, removeItem, setItemStatus, shiftAmongPeers } from '../local/plan'
import { applySessionImport, parseSessionImport, sessionImportTemplate, type SessionImportResult } from '../local/sessionImport'
import { PlanItemEditor } from './local/plan/PlanItemEditor'
import { downloadText } from '../local/download'
import { duplicateSession, liveSessions, nextSessionNumber, purgeSessions, restoreSession, runningSession, startSession, trashSession, trashedSessions, validSessionDate } from '../local/sessions'

type Props = { campaign: LocalCampaignRecord; persist: (next: LocalCampaignRecord) => void; mode?: 'plan' | 'play' | 'review' }
const RECORD_LABEL = { npc: 'NPC', material: 'Материал', secret: 'Секрет' } as const
const statusLabel = { draft: 'Черновик', ready: 'Готова', active: 'Проводится', completed: 'Закрыта' } as const

export function LocalSessionsWorkspace({ campaign, persist, mode = 'plan' }: Props) {
  const navigate = useNavigate()
  const sessions = campaign.sessionRecords
  const live = liveSessions(campaign)
  const trash = trashedSessions(campaign)
  const running = runningSession(campaign)
  const acting = useActing(campaign)
  const byMode = mode === 'play' ? live.find((item) => item.status === 'active') : mode === 'review' ? [...live].reverse().find((item) => item.status === 'completed' && item.reviewStatus === 'draft') ?? [...live].reverse().find((item) => item.status === 'completed') : undefined
  const initialId = byMode?.id ?? (campaign.activeSessionId && live.some((item) => item.id === campaign.activeSessionId) ? campaign.activeSessionId : live[0]?.id)
  const [selectedId, setSelectedId] = useState(initialId ?? '')
  const selected = live.find((item) => item.id === selectedId) ?? live[0]
  const [editor, setEditor] = useState<LocalSessionRecord | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  /** Library picker: `undefined` is closed, otherwise the scene it adds to (`null` — outside scenes). */
  const [pickerTarget, setPickerTarget] = useState<PlanTarget | undefined>(undefined)
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null)
  const importInput = useRef<HTMLInputElement>(null)
  /** Parsed import file awaiting confirmation, or the reason it could not be read. */
  const [pendingImport, setPendingImport] = useState<SessionImportResult | { error: string } | null>(null)
  /** Whether the import also creates the NPCs, materials and secrets it names. */
  const [createRecords, setCreateRecords] = useState(true)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const editingEntity = editingEntityId ? campaign.entities.find((entity) => entity.id === editingEntityId) : undefined
  const updateSession = (next: LocalSessionRecord) => persist(withLocalSessions(campaign, sessions.map((item) => item.id === next.id ? next : item), next.id))
  const choose = (id: string) => { setSelectedId(id); persist(withLocalSessions(campaign, sessions, id)) }
  const create = () => setEditor(blankSession(nextSessionNumber(campaign), acting.master.id, new Date().toISOString()))
  const savePassport = () => {
    if (!editor?.title.trim() || !validSessionDate(editor.date)) return
    const previous = sessions.find((item) => item.id === editor.id)
    const titled = { ...editor, title: editor.title.trim() }
    const next = previous && previous.masterId !== titled.masterId ? handOver({ ...titled, masterId: previous.masterId }, titled.masterId, acting.master.id, new Date().toISOString()) : titled
    persist(withLocalSessions(campaign, previous ? sessions.map((item) => item.id === next.id ? next : item) : [...sessions, next], next.id))
    setSelectedId(next.id)
    setEditor(null)
  }
  const newItem = (patch: Partial<LocalSessionPlanItem> & Pick<LocalSessionPlanItem, 'text' | 'kind' | 'priority'>, target: PlanTarget): LocalSessionPlanItem => ({ id: `plan-${crypto.randomUUID()}`, source: 'text', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared', ...patch, ...(target && patch.kind !== 'scene' ? { sceneId: target } : {}) })
  const addText = (text: string, kind: LocalSessionPlanKind, priority: LocalSessionPlanItem['priority'], target: PlanTarget) => { if (!selected || !text.trim()) return; updateSession({ ...selected, planItems: [...selected.planItems, newItem({ text: text.trim(), kind, priority }, target)] }) }
  /** Puts library records and secrets into the plan in one write. */
  const addLinked = (sources: LinkedSource[], target: PlanTarget, priority: LocalSessionPlanItem['priority']) => {
    if (!selected) return
    const linked = new Set(selected.planItems.flatMap((item) => [item.entityId, item.secretId]))
    const items = sources.filter((source) => !linked.has(source.id)).flatMap((source): LocalSessionPlanItem[] => {
      if (source.type === 'secret') { const secret = campaign.secrets.find((item) => item.id === source.id); return secret ? [newItem({ secretId: secret.id, text: secret.title, kind: 'secret', priority }, target)] : [] }
      const entity = campaign.entities.find((item) => item.id === source.id)
      return entity ? [newItem({ source: 'library', entityId: entity.id, text: entity.name, kind: entity.type === 'npc' ? 'npc' : entity.type === 'handout' || entity.type === 'map' ? 'material' : 'note', priority }, target)] : []
    })
    if (items.length) updateSession({ ...selected, planItems: [...selected.planItems, ...items] })
  }
  const itemTitle = (item: LocalSessionPlanItem) => item.secretId ? campaign.secrets.find((secret) => secret.id === item.secretId)?.title ?? item.text : item.entityId ? campaign.entities.find((entity) => entity.id === item.entityId)?.name ?? item.text : item.text
  const patchItem = (id: string, patch: Partial<LocalSessionPlanItem>) => selected && updateSession({ ...selected, planItems: selected.planItems.map((item) => item.id === id ? { ...item, ...patch } : item) })
  const moveItem = (id: string, delta: number) => { if (!selected) return; const list = [...selected.planItems]; const at = list.findIndex((item) => item.id === id); const to = Math.max(0, Math.min(list.length - 1, at + delta)); if (at === to) return; const [item] = list.splice(at, 1); list.splice(to, 0, item); updateSession({ ...selected, planItems: list }) }
  const saveToLibrary = (item: LocalSessionPlanItem) => {
    if (!selected || item.source === 'library' || item.secretId) return
    if (item.kind === 'secret') {
      const secret = newSecret({ title: item.text, truth: item.note || item.text, sessionIds: [selected.id] })
      const nextSession = { ...selected, planItems: selected.planItems.map((current) => current.id === item.id ? { ...current, secretId: secret.id } : current) }
      persist(withLocalSessions({ ...campaign, secrets: [...campaign.secrets, secret] }, sessions.map((current) => current.id === selected.id ? nextSession : current), selected.id))
      return
    }
    const map: Partial<Record<LocalSessionPlanKind, LocalCampaignEntityType>> = { npc: 'npc', material: 'handout' }
    const entity = newEntity({ type: map[item.kind] ?? 'note', name: item.text, description: item.note, origin: { kind: 'plan', sessionId: selected.id } })
    const nextSession = { ...selected, planItems: selected.planItems.map((current) => current.id === item.id ? { ...current, source: 'library' as const, entityId: entity.id } : current) }
    persist(withLocalSessions({ ...campaign, entities: [...campaign.entities, entity] }, sessions.map((current) => current.id === selected.id ? nextSession : current), selected.id))
  }

  const readImport = async (file: File | undefined) => {
    if (!file) return
    setCreateRecords(true)
    try { setPendingImport(parseSessionImport(await file.text(), campaign, acting.master.id, new Date().toISOString())) } catch (error) { setPendingImport({ error: error instanceof Error ? error.message : 'Не удалось прочитать файл' }) }
  }
  const confirmImport = () => {
    if (!pendingImport || 'error' in pendingImport) return
    persist(applySessionImport(campaign, pendingImport, createRecords))
    setSelectedId(pendingImport.sessions[0].id)
    setPendingImport(null)
  }
  const downloadTemplate = () => downloadText('masterboard-sessions-template.json', sessionImportTemplate(campaign))

  const openNext = (next: LocalCampaignRecord) => { persist(next); if (next.activeSessionId) setSelectedId(next.activeSessionId) }
  const duplicate = () => selected && openNext(duplicateSession(campaign, selected.id, new Date().toISOString()))
  const toTrash = () => selected && openNext(trashSession(campaign, selected.id, new Date().toISOString()))
  const restore = (id: string) => openNext(restoreSession(campaign, id))
  const confirm = useConfirm()
  const deletable = trash.filter((session) => acting.canRun(session))
  const purge = (list: LocalSessionRecord[]) => confirm({
    title: list.length === 1 ? `Удалить №${list[0].number} «${list[0].title}» навсегда?` : `Очистить корзину (${list.length})?`,
    message: list.length === 1 ? 'Вернуть её будет нельзя: план, лог и разбор удалятся вместе с сессией.' : 'Вернуть их будет нельзя: план, лог и разбор удалятся вместе с сессиями.',
    confirmLabel: 'Удалить навсегда', cancelLabel: 'Отмена',
    onConfirm: () => openNext(purgeSessions(campaign, list.map((session) => session.id))),
  })
  const start = () => { if (!selected) return; persist(startSession(campaign, selected.id)); navigate(`/local/campaign/${campaign.id}/play`) }
  const startBlocked = selected && running && running.id !== selected.id ? `Сессия №${running.number} уже идёт — завершите её, прежде чем начинать новую` : undefined
  const trashHint = selected?.status === 'active' ? 'Сессия ещё идёт — сначала завершите её' : selected && !acting.canRun(selected) ? runSessionHint(campaign, selected) : undefined

  const planApi: PlanApi | null = selected ? {
    campaign,
    session: selected,
    itemTitle,
    update: updateSession,
    patchItem: (id, patch) => { patchItem(id, patch) },
    setStatus: (id, status) => updateSession(setItemStatus(selected, id, status)),
    move: (id, target) => updateSession(moveItemTo(selected, id, target)),
    shift: moveItem,
    shiftAmongPeers: (id, delta) => updateSession(shiftAmongPeers(selected, id, delta)),
    remove: (id) => updateSession(removeItem(selected, id)),
    saveToLibrary,
    addText,
    addLinked,
    openPicker: (target) => setPickerTarget(target),
    editEntity: (id) => setEditingEntityId(id),
    editItem: (id) => setEditingItemId(id),
  } : null
  const editingItem = editingItemId ? selected?.planItems.find((item) => item.id === editingItemId) : undefined

  return <main className="sessions-workspace">
    <header className="sessions-workspace__top"><Link to={`/local/campaign/${campaign.id}/overview`}><Icon name="arrow-left" size={16} /> {campaign.name}</Link><CampaignNav campaignId={campaign.id} section={mode === 'plan' ? 'session' : mode} /><div className="row"><ActingMasterSelect campaign={campaign} /><StorageBadge campaignId={campaign.id} /></div></header>
    <div className="sessions-workspace__body">
      <aside className="sessions-workspace__rail"><div className="panel-heading"><div><span className="panel-kicker">Кампания</span><h2>Сессии</h2></div><Button size="sm" icon="plus" onClick={create}>Новая</Button></div><div className="sessions-workspace__session-list">{live.map((session) => <button key={session.id} className={session.id === selected?.id ? 'active' : ''} onClick={() => choose(session.id)}><span>{String(session.number).padStart(2, '0')}</span><div><strong>{session.title}</strong><small>{[statusLabel[session.status], formatDate(session.date), session.inGameTime || 'время не задано'].filter(Boolean).join(' · ')}</small></div></button>)}</div>{!live.length && <EmptyState icon="clapperboard" title="Сессий пока нет" hint="Создайте первую или планируйте несколько заранее." action={<Button variant="primary" onClick={create}>Создать сессию</Button>} />}{trash.length > 0 && <details className="sessions-workspace__trash"><summary>Корзина · {trash.length}</summary><ul>{trash.map((session) => <li key={session.id}><span>№{session.number} {session.title}</span><Button size="sm" icon="refresh-cw" disabled={!acting.canRun(session)} title={acting.canRun(session) ? undefined : runSessionHint(campaign, session)} onClick={() => restore(session.id)}>Восстановить</Button><Button size="sm" tone="danger" icon="trash-2" aria-label={`Удалить навсегда №${session.number} ${session.title}`} title={acting.canRun(session) ? 'Удалить навсегда' : runSessionHint(campaign, session)} disabled={!acting.canRun(session)} onClick={() => purge([session])} /></li>)}</ul>{deletable.length > 1 && <Button size="sm" tone="danger" icon="trash-2" onClick={() => purge(deletable)}>Очистить корзину</Button>}</details>}<details className="sessions-workspace__trash sessions-workspace__import"><summary>Импорт из файла</summary><p>Подготовьте сессии в JSON по шаблону — сцены, пункты плана и переходы появятся черновиками.</p><div className="row"><Button size="sm" icon="download" onClick={downloadTemplate}>Шаблон</Button><Button size="sm" icon="upload" onClick={() => importInput.current?.click()}>Импортировать JSON</Button></div><input ref={importInput} type="file" accept="application/json,.json" hidden aria-label="Файл сессий для импорта" onChange={(event) => { void readImport(event.target.files?.[0]); event.target.value = '' }} /></details></aside>
      {selected && <section className="session-plan"><header className="session-plan__passport"><div><span className="panel-kicker">Сессия {String(selected.number).padStart(2, '0')} · {statusLabel[selected.status]}</span><h1>{selected.title}</h1><p>{selected.focus || selected.idea || 'Фокус пока не задан.'}</p></div><div className="session-plan__actions"><Button icon="pencil" onClick={() => setEditor(structuredClone(selected))}>Паспорт</Button><Button icon="copy" onClick={duplicate}>Дублировать</Button><Button icon="trash-2" disabled={Boolean(trashHint)} title={trashHint} onClick={toTrash}>В корзину</Button>{selected.status === 'active' ? <Button variant="primary" onClick={() => navigate(`/local/campaign/${campaign.id}/play`)}>Панель проведения</Button> : selected.status === 'completed' ? <Button variant="primary" onClick={() => navigate(`/local/campaign/${campaign.id}/review`)}>Разобрать</Button> : <Button variant="primary" icon="play" title={startBlocked ?? (acting.canRun(selected) ? undefined : runSessionHint(campaign, selected))} disabled={!selected.planItems.length || !acting.canRun(selected) || Boolean(startBlocked)} onClick={start}>Начать</Button>}</div></header>
        <dl className="session-plan__meta"><div><dt>Ответственный мастер</dt><dd>{masterName(campaign, selected.masterId)}{selected.handovers.length > 0 && <small className="session-plan__handovers">{selected.handovers.map((handover) => `${masterName(campaign, handover.fromId)} → ${masterName(campaign, handover.toId)}`).join('; ')}</small>}</dd></div><div><dt>Группа и участники</dt><dd>{[campaign.groups.find((group) => group.id === selected.groupId)?.name, sessionPlayers(campaign, selected).map((player) => player.name).join(', '), selected.participants].filter(Boolean).join(' · ') || 'Не заданы'}</dd></div><div><dt>Дата игры</dt><dd>{formatDate(selected.date) || 'Не назначена'}</dd></div><div><dt>Время и шкала</dt><dd>{[selected.inGameTime, selected.timelinePosition].filter(Boolean).join(' · ') || 'Не заданы'}</dd></div><div><dt>Стартовая ситуация</dt><dd>{selected.opening || 'Не задана'}</dd></div></dl>
        {planApi && <PlanViews api={planApi} actions={<><Button icon="plus" variant={panelOpen ? 'primary' : undefined} aria-pressed={panelOpen} onClick={() => setPanelOpen(!panelOpen)}>Добавить в план</Button><Button icon="library" onClick={() => setPickerTarget(null)}>Из библиотеки</Button></>} panel={panelOpen ? <PlanAddPanel api={planApi} close={() => setPanelOpen(false)} /> : undefined} />}
        {selected.status === 'active' && <LivePanel campaign={campaign} session={selected} persist={persist} canClose={acting.canRun(selected)} closeHint={runSessionHint(campaign, selected)} onClose={() => { updateSession({ ...selected, status: 'completed' }); navigate(`/local/campaign/${campaign.id}/review`) }} />}
        {mode === 'play' && selected.status !== 'active' && <p className="session-plan__notice" role="status">Эта сессия сейчас не проводится. {selected.status === 'completed' ? 'Она уже закрыта — откройте разбор.' : 'Нажмите «Начать», чтобы открыть живую панель.'}</p>}
        {mode === 'review' && selected.status !== 'completed' && <p className="session-plan__notice" role="status">Разбор откроется, когда сессия будет закрыта.</p>}
        {selected.status === 'completed' && <ReviewWizard key={selected.id} campaign={campaign} session={selected} persist={persist} canComplete={acting.canRun(selected)} completeHint={runSessionHint(campaign, selected)} itemTitle={itemTitle} openSession={(id) => { choose(id); navigate(`/local/campaign/${campaign.id}/session`) }} />}
      </section>}
    </div>
    {editor && <Modal title={sessions.some((item) => item.id === editor.id) ? 'Паспорт сессии' : 'Новая сессия'} close={() => setEditor(null)}><div className="session-passport-form"><label>Название<input autoFocus value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} /></label><div className="control-form__row"><label>Номер<input type="number" min="1" value={editor.number} onChange={(event) => setEditor({ ...editor, number: Number(event.target.value) })} /></label><label>Статус<Select value={editor.status} onChange={(event) => setEditor({ ...editor, status: event.target.value as LocalSessionRecord['status'] })}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label><label>Ответственный мастер<Select aria-label="Ответственный мастер" value={editor.masterId} disabled={sessions.some((item) => item.id === editor.id) && !acting.canRun(sessions.find((item) => item.id === editor.id)!)} onChange={(event) => setEditor({ ...editor, masterId: event.target.value })}>{campaign.masters.map((master) => <option key={master.id} value={master.id}>{master.name}</option>)}</Select></label></div><div className="control-form__row"><label>Группа<Select aria-label="Группа" value={editor.groupId} onChange={(event) => setEditor({ ...editor, groupId: event.target.value, guestPlayerIds: editor.guestPlayerIds.filter((id) => !campaign.groups.find((group) => group.id === event.target.value)?.playerIds.includes(id)) })}><option value="">Без группы</option>{campaign.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select></label><label>Заметка об участниках<input value={editor.participants} onChange={(event) => setEditor({ ...editor, participants: event.target.value })} /></label><label>Дата игры<input type="date" value={editor.date} aria-invalid={!validSessionDate(editor.date)} onChange={(event) => setEditor({ ...editor, date: event.target.value })} /></label></div>{!validSessionDate(editor.date) && <p className="session-plan__notice" role="alert">Такой даты нет в календаре.</p>}<Checklist legend="Приглашённые игроки" options={campaign.players.filter((player) => !campaign.groups.find((group) => group.id === editor.groupId)?.playerIds.includes(player.id)).map((player) => ({ id: player.id, label: player.name }))} value={editor.guestPlayerIds} onChange={(guestPlayerIds) => setEditor({ ...editor, guestPlayerIds })} empty="Все игроки уже в группе или пул игроков пуст (раздел «Команда»)." /><div className="control-form__row"><label>Арка<Select value={editor.arcId} onChange={(event) => setEditor({ ...editor, arcId: event.target.value })}><option value="">Без арки</option>{campaign.storyArcs.map((arc) => <option key={arc.id} value={arc.id}>{arc.title}</option>)}</Select></label><label>Внутриигровое время<input value={editor.inGameTime} onChange={(event) => setEditor({ ...editor, inGameTime: event.target.value })} /></label><label>Положение на шкале<input value={editor.timelinePosition} onChange={(event) => setEditor({ ...editor, timelinePosition: event.target.value })} /></label></div>{campaign.storyArcs.length > 1 && <fieldset className="session-passport-form__arcs"><legend>Фоновые линии</legend>{campaign.storyArcs.filter((arc) => arc.id !== editor.arcId).map((arc) => <label key={arc.id}><input type="checkbox" checked={editor.backgroundArcIds.includes(arc.id)} onChange={() => setEditor({ ...editor, backgroundArcIds: toggleId(editor.backgroundArcIds, arc.id) })} /> {arc.title}</label>)}</fieldset>}<label>Идея<textarea rows={2} value={editor.idea} onChange={(event) => setEditor({ ...editor, idea: event.target.value })} /></label><label>Цель, вопрос или тема<textarea rows={2} value={editor.focus} onChange={(event) => setEditor({ ...editor, focus: event.target.value })} /></label><label>Стартовая ситуация<textarea rows={2} value={editor.opening} onChange={(event) => setEditor({ ...editor, opening: event.target.value })} /></label><div className="control-form__row"><label>Связанные линии<input value={editor.lines} onChange={(event) => setEditor({ ...editor, lines: event.target.value })} /></label><label>Слои<input value={editor.layers} onChange={(event) => setEditor({ ...editor, layers: event.target.value })} /></label><label>Системы и миры<input value={editor.systems} onChange={(event) => setEditor({ ...editor, systems: event.target.value })} /></label></div></div><footer><Button onClick={() => setEditor(null)}>Отмена</Button><Button variant="primary" disabled={!editor.title.trim() || !validSessionDate(editor.date)} onClick={savePassport}>Сохранить</Button></footer></Modal>}
    {pendingImport && <Modal title="Импорт сессий" close={() => setPendingImport(null)}>{'error' in pendingImport ? <p className="session-plan__notice" role="alert">{pendingImport.error}</p> : <div className="sessions-import-preview"><p>Будут созданы черновики:</p><ul>{pendingImport.sessions.map((session) => <li key={session.id}><strong>№{session.number} {session.title}</strong> <small>{session.planItems.filter((item) => item.kind === 'scene').length} сцен · {session.planItems.length} пунктов плана · {session.flows.length} переходов</small></li>)}</ul>{pendingImport.newRecords.length > 0 && <fieldset className="sessions-import-preview__records"><legend>Новые записи · {pendingImport.newRecords.length}</legend><label><input type="checkbox" checked={createRecords} onChange={(event) => setCreateRecords(event.target.checked)} /> Создать в библиотеке и секретах</label><ul>{pendingImport.newRecords.map((record) => <li key={`${record.kind}-${record.name}`}><small>{RECORD_LABEL[record.kind]}</small> {record.name}</li>)}</ul>{!createRecords && <p className="muted">Останутся текстом в плане — перенести можно потом кнопкой «В библиотеку».</p>}</fieldset>}{pendingImport.warnings.length > 0 && <details open><summary>Замечания · {pendingImport.warnings.length}</summary><ul>{pendingImport.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}</div>}<footer><Button onClick={() => setPendingImport(null)}>{'error' in pendingImport ? 'Закрыть' : 'Отмена'}</Button>{!('error' in pendingImport) && <Button variant="primary" icon="upload" onClick={confirmImport}>Импортировать · {pendingImport.sessions.length}</Button>}</footer></Modal>}
    {planApi && pickerTarget !== undefined && <LibraryPicker api={planApi} target={pickerTarget} close={() => setPickerTarget(undefined)} />}
    {planApi && editingItem && <PlanItemEditor api={planApi} item={editingItem} close={() => setEditingItemId(null)} />}
    {editingEntity && <EntityEditor campaign={campaign} persist={persist} entity={editingEntity} close={() => setEditingEntityId(null)} />}
  </main>
}

const formatDate = (date: string) => date ? new Date(`${date}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
