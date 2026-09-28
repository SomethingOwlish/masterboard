import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, EmptyState } from '../../ds'
import { entityUsages, originLabel } from '../../local/domain'
import { ROLE_LABEL, SYSTEM_LABEL, entityRoles, linkedRole } from '../../local/integration'
import type { LocalCampaignRecord } from '../../local/types'
import { EntityDetails } from './EntityDetails'
import { EntityEditor } from './EntityEditor'
import { PeekLink } from './Peek'
import { SourceLinks } from './SourcePanels'
import type { Persist } from './shared'
import { ENTITY_STATUS_LABEL, ENTITY_LABEL, VISIBILITY_LABEL, RELATION_TYPE } from '../../local/labels'


/** «Открыть полностью» (ТЗ-2, R9): everything about one library record on its own page. */
export function EntityPage({ campaign, persist, entityId }: { campaign: LocalCampaignRecord; persist: Persist; entityId: string }) {
  const [editing, setEditing] = useState(false)
  const entity = campaign.entities.find((item) => item.id === entityId)
  if (!entity) return <section className="campaign-section"><EmptyState icon="search-x" title="Сущность не найдена" hint="Её удалили или ссылка устарела." action={<Link to={`/local/campaign/${campaign.id}/library`}>В библиотеку</Link>} /></section>
  const usages = entityUsages(campaign, entity.id)
  const name = (id: string) => campaign.entities.find((item) => item.id === id)?.name ?? 'удалена'
  const places = entityRoles(campaign, entity).map((role) => `${ROLE_LABEL[role]} · ${SYSTEM_LABEL[linkedRole(campaign, role)!.system]}`)
  const archive = () => persist({ ...campaign, entities: campaign.entities.map((item) => item.id === entity.id ? { ...item, status: item.status === 'archived' ? 'active' : 'archived' } : item) })
  return <section className="campaign-section entity-page">
    <nav className="entity-page__crumbs" aria-label="Путь"><Link to={`/local/campaign/${campaign.id}/library`}>Библиотека</Link> › {ENTITY_LABEL[entity.type]}</nav>
    <div className="section-bar"><div><h2>{entity.name}</h2><div className="row">{[VISIBILITY_LABEL[entity.visibility], ENTITY_STATUS_LABEL[entity.status], ...(entity.dead ? ['Погиб'] : [])].map((badge) => <Badge key={badge} size="sm">{badge}</Badge>)}</div></div><div className="row"><Button icon={entity.status === 'archived' ? 'undo-2' : 'history'} onClick={archive}>{entity.status === 'archived' ? 'Вернуть из архива' : 'В архив'}</Button><Button variant="primary" icon="pencil" onClick={() => setEditing(true)}>Редактировать</Button></div></div>
    <div className="entity-page__layout">
      <div className="entity-page__main">
        <p className="entity-page__description">{entity.description || <span className="muted">Описание пока не добавлено.</span>}</p>
        <EntityDetails entity={entity} className="peek-fields entity-page__fields" fate={false} />
        {entity.tags.length > 0 && <p className="row">{entity.tags.map((tag) => <Badge size="sm" key={tag}>#{tag}</Badge>)}</p>}
        <h3>Связи</h3>
        {usages.relations.length ? <ul className="entity-page__list">{usages.relations.map((relation) => { const other = relation.fromId === entity.id ? relation.toId : relation.fromId; return <li key={relation.id}><span className="muted">{RELATION_TYPE[relation.type]}{relation.direction === 'directed' ? (relation.fromId === entity.id ? ' →' : ' ←') : ' ↔'}</span> <PeekLink target={{ kind: 'entity', id: other }}>{name(other)}</PeekLink>{relation.label && <small> · {relation.label}</small>}</li> })}</ul> : <p className="muted">Связей нет. <Link to={`/local/campaign/${campaign.id}/map`}>Добавить в «Связях»</Link></p>}
      </div>
      <aside className="entity-page__side">
        <h3>Где используется</h3>
        {usages.plans.length + usages.clocks.length + usages.secrets.length ? <ul className="entity-page__list">
          {usages.plans.map((usage) => <li key={`${usage.sessionId}:${usage.itemId}`}><PeekLink target={{ kind: 'session', id: usage.sessionId }}>Сессия №{usage.sessionNumber} {usage.sessionTitle}</PeekLink>{usage.sceneTitle && <small> · {usage.sceneTitle}</small>}{usage.trashed && <small> (в корзине)</small>}</li>)}
          {usages.clocks.map((clock) => <li key={clock.id}><PeekLink target={{ kind: 'clock', id: clock.id }}>Часы «{clock.title}»</PeekLink></li>)}
          {usages.secrets.map((secret) => <li key={secret.id}><PeekLink target={{ kind: 'secret', id: secret.id }}>Секрет «{secret.title}»</PeekLink></li>)}
        </ul> : <p className="muted">Пока нигде.</p>}
        <h3>Куда отправлять</h3>
        <p>{places.length ? places.join(', ') : 'Никуда, только в Мастерборде'}</p>
        <h3>Источник</h3>
        <p className="muted">{originLabel(entity, campaign)}</p>
        <SourceLinks campaign={campaign} entity={entity} persist={persist} />
      </aside>
    </div>
    {editing && <EntityEditor campaign={campaign} persist={persist} entity={entity} close={() => setEditing(false)} />}
  </section>
}
