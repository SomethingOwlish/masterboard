import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, EmptyState, Icon, Select } from '../ds'
import { newEntity, newSecret, toggleId } from '../local/domain'
import { blankSession, withLocalSessions } from '../local/normalize'
import type { LocalCampaignEntityType, LocalCampaignRecord, LocalSessionPlanItem, LocalSessionPlanKind, LocalSessionRecord } from '../local/types'
import { LivePanel } from './local/LivePanel'
import { ReviewWizard } from './local/ReviewWizard'
import { CampaignNav, Checklist, StorageBadge } from './local/shared'
import { ActingMasterSelect } from './local/ActingMasterSelect'
import { useActing } from '../local/actingContext'
import { handOver, masterName, runSessionHint, sessionPlayers } from '../local/team'
import { PlanViews } from './local/plan/PlanViews'
import { PLAN_KINDS, PRIORITIES, type PlanApi } from './local/plan/planApi'
import { moveItemTo, removeItem, setItemStatus } from '../local/plan'

type Props = { campaign: LocalCampaignRecord; persist: (next: LocalCampaignRecord) => void; mode?: 'plan' | 'play' | 'review' }
const priorities = PRIORITIES
const kinds = PLAN_KINDS
const statusLabel = { draft: 'Черновик', ready: 'Готова', active: 'Проводится', completed: 'Закрыта' } as const

export function LocalSessionsWorkspace({ campaign, persist, mode = 'plan' }: Props) {
  const navigate = useNavigate()
  const sessions = campaign.sessionRecords
  const acting = useActing(campaign)
  const byMode = mode === 'play' ? sessions.find((item) => item.status === 'active') : mode === 'review' ? [...sessions].reverse().find((item) => item.status === 'completed' && item.reviewStatus === 'draft') ?? [...sessions].reverse().find((item) => item.status === 'completed') : undefined
  const initialId = byMode?.id ?? (campaign.activeSessionId && sessions.some((item) => item.id === campaign.activeSessionId) ? campaign.activeSessionId : sessions[0]?.id)
  const [selectedId, setSelectedId] = useState(initialId ?? '')
  const selected = sessions.find((item) => item.id === selectedId) ?? sessions[0]
  const [editor, setEditor] = useState<LocalSessionRecord | null>(null)
  const [quickText, setQuickText] = useState('')
  const [quickKind, setQuickKind] = useState<LocalSessionPlanKind>('scene')
  const [quickPriority, setQuickPriority] = useState<LocalSessionPlanItem['priority']>('desired')
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [secretsOpen, setSecretsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const linkedIds = useMemo(() => new Set(selected?.planItems.flatMap((item) => [item.entityId, item.secretId].filter((id): id is string => Boolean(id))) ?? []), [selected])
  const updateSession = (next: LocalSessionRecord) => persist(withLocalSessions(campaign, sessions.map((item) => item.id === next.id ? next : item), next.id))
  const choose = (id: string) => { setSelectedId(id); persist(withLocalSessions(campaign, sessions, id)) }
  const create = () => setEditor(blankSession(Math.max(0, ...sessions.map((item) => item.number)) + 1, acting.master.id, new Date().toISOString()))
  const savePassport = () => {
    if (!editor?.title.trim()) return
    const previous = sessions.find((item) => item.id === editor.id)
    const titled = { ...editor, title: editor.title.trim() }
    const next = previous && previous.masterId !== titled.masterId ? handOver({ ...titled, masterId: previous.masterId }, titled.masterId, acting.master.id, new Date().toISOString()) : titled
    persist(withLocalSessions(campaign, previous ? sessions.map((item) => item.id === next.id ? next : item) : [...sessions, next], next.id))
    setSelectedId(next.id)
    setEditor(null)
  }
  const addText = () => { const text = quickText.trim(); if (!text || !selected) return; updateSession({ ...selected, planItems: [...selected.planItems, { id: `plan-${crypto.randomUUID()}`, source: 'text', text, kind: quickKind, priority: quickPriority, status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared' }] }); setQuickText('') }
  const attachEntity = (entityId: string) => { if (!selected) return; const entity = campaign.entities.find((item) => item.id === entityId); if (!entity) return; updateSession({ ...selected, planItems: [...selected.planItems, { id: `plan-${crypto.randomUUID()}`, source: 'library', entityId, text: entity.name, kind: entity.type === 'npc' ? 'npc' : entity.type === 'handout' || entity.type === 'map' ? 'material' : 'note', priority: quickPriority, status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared' }] }) }
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
  const attachSecret = (secretId: string) => { if (!selected) return; const secret = campaign.secrets.find((item) => item.id === secretId); if (!secret) return; updateSession({ ...selected, planItems: [...selected.planItems, { id: `plan-${crypto.randomUUID()}`, source: 'text', secretId, text: secret.title, kind: 'secret', priority: quickPriority, status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared' }] }) }

  const planApi: PlanApi | null = selected ? {
    session: selected,
    itemTitle,
    update: updateSession,
    patchItem: (id, patch) => { patchItem(id, patch) },
    setStatus: (id, status) => updateSession(setItemStatus(selected, id, status)),
    move: (id, target) => updateSession(moveItemTo(selected, id, target)),
    shift: moveItem,
    remove: (id) => updateSession(removeItem(selected, id)),
    saveToLibrary,
  } : null

  return <main className="sessions-workspace">
    <header className="sessions-workspace__top"><Link to={`/local/campaign/${campaign.id}/overview`}><Icon name="arrow-left" size={16} /> {campaign.name}</Link><CampaignNav campaignId={campaign.id} section={mode === 'plan' ? 'session' : mode} /><div className="row"><ActingMasterSelect campaign={campaign} /><StorageBadge campaignId={campaign.id} /></div></header>
    <div className="sessions-workspace__body">
      <aside className="sessions-workspace__rail"><div className="panel-heading"><div><span className="panel-kicker">Кампания</span><h2>Сессии</h2></div><Button size="sm" icon="plus" onClick={create}>Новая</Button></div><div className="sessions-workspace__session-list">{sessions.map((session) => <button key={session.id} className={session.id === selected?.id ? 'active' : ''} onClick={() => choose(session.id)}><span>{String(session.number).padStart(2, '0')}</span><div><strong>{session.title}</strong><small>{statusLabel[session.status]} · {session.inGameTime || 'время не задано'}</small></div></button>)}</div>{!sessions.length && <EmptyState icon="clapperboard" title="Сессий пока нет" hint="Создайте первую или планируйте несколько заранее." action={<Button variant="primary" onClick={create}>Создать сессию</Button>} />}</aside>
      {selected && <section className="session-plan"><header className="session-plan__passport"><div><span className="panel-kicker">Сессия {String(selected.number).padStart(2, '0')} · {statusLabel[selected.status]}</span><h1>{selected.title}</h1><p>{selected.focus || selected.idea || 'Фокус пока не задан.'}</p></div><div className="session-plan__actions"><Button icon="pencil" onClick={() => setEditor(structuredClone(selected))}>Паспорт</Button>{selected.status === 'active' ? <Button variant="primary" onClick={() => navigate(`/local/campaign/${campaign.id}/play`)}>Панель проведения</Button> : selected.status === 'completed' ? <Button variant="primary" onClick={() => navigate(`/local/campaign/${campaign.id}/review`)}>Разобрать</Button> : <Button variant="primary" icon="play" title={acting.canRun(selected) ? undefined : runSessionHint(campaign, selected)} disabled={!selected.planItems.length || !acting.canRun(selected)} onClick={() => { updateSession({ ...selected, status: 'active' }); navigate(`/local/campaign/${campaign.id}/play`) }}>Начать</Button>}</div></header>
        <dl className="session-plan__meta"><div><dt>Ответственный мастер</dt><dd>{masterName(campaign, selected.masterId)}{selected.handovers.length > 0 && <small className="session-plan__handovers">{selected.handovers.map((handover) => `${masterName(campaign, handover.fromId)} → ${masterName(campaign, handover.toId)}`).join('; ')}</small>}</dd></div><div><dt>Группа и участники</dt><dd>{[campaign.groups.find((group) => group.id === selected.groupId)?.name, sessionPlayers(campaign, selected).map((player) => player.name).join(', '), selected.participants].filter(Boolean).join(' · ') || 'Не заданы'}</dd></div><div><dt>Время и шкала</dt><dd>{[selected.inGameTime, selected.timelinePosition].filter(Boolean).join(' · ') || 'Не заданы'}</dd></div><div><dt>Стартовая ситуация</dt><dd>{selected.opening || 'Не задана'}</dd></div></dl>
        <section className="session-plan__composer"><div className="row"><Select aria-label="Тип пункта плана" value={quickKind} onChange={(event) => setQuickKind(event.target.value as LocalSessionPlanKind)}>{kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><Select aria-label="Приоритет пункта" value={quickPriority} onChange={(event) => setQuickPriority(event.target.value as LocalSessionPlanItem['priority'])}>{priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div><input aria-label="Свободный текст пункта плана" value={quickText} placeholder="Сцена, идея, вопрос или любой свободный текст…" onChange={(event) => setQuickText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addText() }} /><Button variant="primary" disabled={!quickText.trim()} onClick={addText}>Добавить текстом</Button><Button icon="library" onClick={() => setLibraryOpen(true)}>Из библиотеки</Button><Button icon="shield" onClick={() => setSecretsOpen(true)}>Из секретов</Button></section>
        {planApi && <PlanViews api={planApi} />}
        {selected.status === 'active' && <LivePanel campaign={campaign} session={selected} persist={persist} canClose={acting.canRun(selected)} closeHint={runSessionHint(campaign, selected)} onClose={() => { updateSession({ ...selected, status: 'completed' }); navigate(`/local/campaign/${campaign.id}/review`) }} />}
        {mode === 'play' && selected.status !== 'active' && <p className="session-plan__notice" role="status">Эта сессия сейчас не проводится. {selected.status === 'completed' ? 'Она уже закрыта — откройте разбор.' : 'Нажмите «Начать», чтобы открыть живую панель.'}</p>}
        {mode === 'review' && selected.status !== 'completed' && <p className="session-plan__notice" role="status">Разбор откроется, когда сессия будет закрыта.</p>}
        {selected.status === 'completed' && <ReviewWizard key={selected.id} campaign={campaign} session={selected} persist={persist} canComplete={acting.canRun(selected)} completeHint={runSessionHint(campaign, selected)} itemTitle={itemTitle} openSession={(id) => { choose(id); navigate(`/local/campaign/${campaign.id}/session`) }} />}
      </section>}
    </div>
    {editor && <Modal title={sessions.some((item) => item.id === editor.id) ? 'Паспорт сессии' : 'Новая сессия'} close={() => setEditor(null)}><div className="session-passport-form"><label>Название<input autoFocus value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} /></label><div className="control-form__row"><label>Номер<input type="number" min="1" value={editor.number} onChange={(event) => setEditor({ ...editor, number: Number(event.target.value) })} /></label><label>Статус<Select value={editor.status} onChange={(event) => setEditor({ ...editor, status: event.target.value as LocalSessionRecord['status'] })}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label><label>Ответственный мастер<Select aria-label="Ответственный мастер" value={editor.masterId} disabled={sessions.some((item) => item.id === editor.id) && !acting.canRun(sessions.find((item) => item.id === editor.id)!)} onChange={(event) => setEditor({ ...editor, masterId: event.target.value })}>{campaign.masters.map((master) => <option key={master.id} value={master.id}>{master.name}</option>)}</Select></label></div><div className="control-form__row"><label>Группа<Select aria-label="Группа" value={editor.groupId} onChange={(event) => setEditor({ ...editor, groupId: event.target.value, guestPlayerIds: editor.guestPlayerIds.filter((id) => !campaign.groups.find((group) => group.id === event.target.value)?.playerIds.includes(id)) })}><option value="">Без группы</option>{campaign.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select></label><label>Заметка об участниках<input value={editor.participants} onChange={(event) => setEditor({ ...editor, participants: event.target.value })} /></label></div><Checklist legend="Приглашённые игроки" options={campaign.players.filter((player) => !campaign.groups.find((group) => group.id === editor.groupId)?.playerIds.includes(player.id)).map((player) => ({ id: player.id, label: player.name }))} value={editor.guestPlayerIds} onChange={(guestPlayerIds) => setEditor({ ...editor, guestPlayerIds })} empty="Все игроки уже в группе или пул игроков пуст (раздел «Команда»)." /><div className="control-form__row"><label>Арка<Select value={editor.arcId} onChange={(event) => setEditor({ ...editor, arcId: event.target.value })}><option value="">Без арки</option>{campaign.storyArcs.map((arc) => <option key={arc.id} value={arc.id}>{arc.title}</option>)}</Select></label><label>Внутриигровое время<input value={editor.inGameTime} onChange={(event) => setEditor({ ...editor, inGameTime: event.target.value })} /></label><label>Положение на шкале<input value={editor.timelinePosition} onChange={(event) => setEditor({ ...editor, timelinePosition: event.target.value })} /></label></div>{campaign.storyArcs.length > 1 && <fieldset className="session-passport-form__arcs"><legend>Фоновые линии</legend>{campaign.storyArcs.filter((arc) => arc.id !== editor.arcId).map((arc) => <label key={arc.id}><input type="checkbox" checked={editor.backgroundArcIds.includes(arc.id)} onChange={() => setEditor({ ...editor, backgroundArcIds: toggleId(editor.backgroundArcIds, arc.id) })} /> {arc.title}</label>)}</fieldset>}<label>Идея<textarea rows={2} value={editor.idea} onChange={(event) => setEditor({ ...editor, idea: event.target.value })} /></label><label>Цель, вопрос или тема<textarea rows={2} value={editor.focus} onChange={(event) => setEditor({ ...editor, focus: event.target.value })} /></label><label>Стартовая ситуация<textarea rows={2} value={editor.opening} onChange={(event) => setEditor({ ...editor, opening: event.target.value })} /></label><div className="control-form__row"><label>Связанные линии<input value={editor.lines} onChange={(event) => setEditor({ ...editor, lines: event.target.value })} /></label><label>Слои<input value={editor.layers} onChange={(event) => setEditor({ ...editor, layers: event.target.value })} /></label><label>Системы и миры<input value={editor.systems} onChange={(event) => setEditor({ ...editor, systems: event.target.value })} /></label></div></div><footer><Button onClick={() => setEditor(null)}>Отмена</Button><Button variant="primary" disabled={!editor.title.trim()} onClick={savePassport}>Сохранить</Button></footer></Modal>}
    {libraryOpen && <Modal title="Добавить из библиотеки" close={() => setLibraryOpen(false)}><div className="session-library-picker"><input autoFocus value={query} placeholder="Название или тег…" aria-label="Поиск в библиотеке для сессии" onChange={(event) => setQuery(event.target.value)} />{campaign.entities.filter((entity) => entity.status !== 'archived' && !linkedIds.has(entity.id) && `${entity.name} ${entity.tags.join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((entity) => <button key={entity.id} onClick={() => attachEntity(entity.id)}><div><span className="panel-kicker">{entity.type}</span><strong>{entity.name}</strong><small>{entity.description}</small></div><Icon name="plus" size={16} /></button>)}</div><footer><Button onClick={() => setLibraryOpen(false)}>Готово</Button></footer></Modal>}
    {secretsOpen && <Modal title="Добавить секрет в план" close={() => setSecretsOpen(false)}><div className="session-library-picker">{campaign.secrets.filter((secret) => !linkedIds.has(secret.id)).map((secret) => <button key={secret.id} onClick={() => attachSecret(secret.id)}><div><span className="panel-kicker">Секрет</span><strong>{secret.title}</strong><small>{secret.revealCondition ? `Раскрыть: ${secret.revealCondition}` : secret.truth}</small></div><Icon name="plus" size={16} /></button>)}{!campaign.secrets.some((secret) => !linkedIds.has(secret.id)) && <p className="muted">Все секреты уже в плане или ещё не созданы. Создайте их в разделе «Пульт».</p>}</div><footer><Button onClick={() => setSecretsOpen(false)}>Готово</Button></footer></Modal>}
  </main>
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div className="campaign-workspace__scrim" onMouseDown={(event) => { if (event.currentTarget === event.target) close() }}><section className="campaign-workspace__modal sessions-modal" role="dialog" aria-modal="true" aria-label={title}><h2>{title}</h2>{children}</section></div> }
