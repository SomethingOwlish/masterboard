import { Link, useNavigate } from 'react-router-dom'
import { Badge, Button, EmptyState, Icon, Select } from '../ds'
import type { LocalCampaignRecord, LocalReviewDecision } from '../fixtures/localCampaignCatalog'

type Props = { campaign: LocalCampaignRecord; persist: (next: LocalCampaignRecord) => void }
const decisions: Record<LocalReviewDecision, string> = { carry: 'Перенести в следующую', library: 'Вернуть только в библиотеку', cancel: 'Отменить', keep: 'Оставить как неиспользованное' }

export function LocalSessionReview({ campaign, persist }: Props) {
  const navigate = useNavigate()
  const linked = campaign.firstSessionItems ?? []
  const unresolved = linked.filter((item) => ['required', 'desired'].includes(item.priority) && !['used', 'cancelled'].includes(item.status))
  const choices = campaign.firstSessionReviewDecisions ?? {}
  const completed = campaign.firstSessionReviewStatus === 'completed'
  const decide = (id: string, decision: LocalReviewDecision) => persist({ ...campaign, firstSessionReviewDecisions: { ...choices, [id]: decision } })
  const entityName = (entityId: string) => campaign.entities.find((entity) => entity.id === entityId)?.name ?? 'Удалённый объект'
  const finish = () => persist({ ...campaign, firstSessionReviewStatus: 'completed' })
  const createNext = () => {
    const carried = linked.filter((item) => choices[item.id] === 'carry').map((item) => ({ ...item, id: crypto.randomUUID(), status: 'prepared' as const }))
    persist({ ...campaign, sessions: campaign.sessions + 1, firstSessionTitle: `Сессия ${String(campaign.sessions + 1).padStart(2, '0')}`, firstSessionObjective: '', firstSessionOpening: '', firstSessionIdea: '', firstSessionStatus: 'draft', firstSessionScenes: [], firstSessionCurrentSceneId: '', firstSessionLog: [], firstSessionItems: carried, firstSessionFlows: [], firstSessionReviewNotes: '', firstSessionReviewStatus: 'draft', firstSessionReviewDecisions: {} })
    navigate(`/local/campaign/${campaign.id}/session`)
  }
  return <section className="campaign-section local-review"><header className="panel-heading"><div><span className="panel-kicker">После игры</span><h2>Разбор сессии</h2><p>Зафиксируйте последствия и решите судьбу подготовленных элементов.</p></div><Badge tone={completed ? 'success' : 'warning'} dot>{completed ? 'Разбор завершён' : 'Черновик разбора'}</Badge></header>
    <div className="local-review__grid"><section><h3>Неиспользованное</h3>{unresolved.length ? <ol>{unresolved.map((item) => <li key={item.id}><div><strong>{entityName(item.entityId)}</strong><small>{item.priority === 'required' ? 'Обязательный элемент' : 'Желательный элемент'}</small></div><Select aria-label={`Решение для ${entityName(item.entityId)}`} disabled={completed} value={choices[item.id] ?? ''} onChange={(event) => decide(item.id, event.target.value as LocalReviewDecision)}><option value="">Выберите решение</option>{Object.entries(decisions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></li>)}</ol> : <EmptyState icon="check" title="Обязательные элементы разобраны" hint="Все обязательные и желательные элементы использованы либо отменены." />}</section><aside><label htmlFor="review-notes"><span>Итоги и последствия</span><textarea id="review-notes" rows={8} disabled={completed} value={campaign.firstSessionReviewNotes ?? ''} placeholder="Что изменилось в мире, какие линии открылись, что перенести дальше…" onChange={(event) => persist({ ...campaign, firstSessionReviewNotes: event.target.value })} /></label><div className="local-review__summary"><span>Журнал</span><strong>{campaign.firstSessionLog.length}</strong><span>Использовано</span><strong>{linked.filter((item) => item.status === 'used').length}</strong><span>Требует решения</span><strong>{unresolved.filter((item) => !choices[item.id]).length}</strong></div>{completed ? <><Button variant="primary" block icon="plus" onClick={createNext}>Создать следующую сессию</Button><Button block onClick={() => persist({ ...campaign, firstSessionReviewStatus: 'draft' })}>Открыть разбор снова</Button></> : <Button variant="primary" block icon="check" disabled={unresolved.some((item) => !choices[item.id])} onClick={finish}>Завершить разбор</Button>}<Link className="session-play-link" to={`/local/campaign/${campaign.id}/play`}><Icon name="arrow-left" size={15} /> Вернуться к записи игры</Link></aside></div>
  </section>
}
