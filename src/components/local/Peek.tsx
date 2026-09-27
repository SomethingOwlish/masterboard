import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Icon } from '../../ds'
import { ENTITY_STATUS_LABEL, entityUsages, originLabel } from '../../local/domain'
import { ARC_STATUS, SECRET_STATUS } from '../../local/labels'
import { PeekContext, usePeek, type PeekApi } from '../../local/peekContext'
import { SEARCH_GROUP, searchCampaign, type PeekTarget, type SearchHit } from '../../local/search'
import { liveSessions } from '../../local/sessions'
import { masterName, recipientsLabel } from '../../local/team'
import type { LocalCampaignRecord } from '../../local/types'
import { EntityDetails } from './EntityDetails'
import { EntityEditor } from './EntityEditor'
import { SourceLinks } from './SourcePanels'
import { ENTITY_LABEL, type Persist } from './shared'

const RELATION_LABEL = { alliance: 'союз', enmity: 'вражда', debt: 'долг', kin: 'родство', belongs: 'принадлежность', other: 'связь' } as const
const SESSION_STATUS = { draft: 'Черновик', ready: 'Готова', active: 'Идёт', completed: 'Завершена' } as const

/**
 * A name that opens its record in the side panel (ТЗ-2, R9). Outside the
 * campaign page (a section rendered alone) it stays plain text.
 */
export function PeekLink({ target, children, className }: { target: PeekTarget; children: ReactNode; className?: string }) {
  const peek = usePeek()
  if (!peek) return <>{children}</>
  return <button type="button" className={`peek-link${className ? ` ${className}` : ''}`} onClick={(event) => { event.stopPropagation(); peek.open(target) }}>{children}</button>
}

/** Comma-separated names, each opening its record. */
export function PeekList({ items, empty = '—' }: { items: Array<{ target: PeekTarget; name: string }>; empty?: string }) {
  if (!items.length) return <>{empty}</>
  return <>{items.map((item, index) => <span key={`${item.target.kind}:${item.target.id}`}>{index > 0 && ', '}<PeekLink target={item.target}>{item.name}</PeekLink></span>)}</>
}

/**
 * The campaign page's side panel and search. Any `PeekLink` inside opens its
 * record here; Ctrl+K (or ⌘K) opens the search over the whole campaign.
 */
export function PeekProvider({ campaign, persist, children }: { campaign: LocalCampaignRecord; persist: Persist; children: ReactNode }) {
  const [stack, setStack] = useState<PeekTarget[]>([])
  const [searching, setSearching] = useState(false)
  const open = useCallback((target: PeekTarget) => { setSearching(false); setStack((current) => [...current.filter((item) => item.kind !== target.kind || item.id !== target.id), target].slice(-8)) }, [])
  const api = useMemo<PeekApi>(() => ({ open, search: () => setSearching(true) }), [open])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') { event.preventDefault(); setSearching(true) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const current = stack[stack.length - 1]
  return <PeekContext.Provider value={api}>
    {children}
    {current && <PeekDrawer campaign={campaign} persist={persist} target={current} back={stack.length > 1 ? () => setStack(stack.slice(0, -1)) : undefined} close={() => setStack([])} />}
    {searching && <SearchPalette campaign={campaign} close={() => setSearching(false)} />}
  </PeekContext.Provider>
}

function PeekDrawer({ campaign, persist, target, back, close }: { campaign: LocalCampaignRecord; persist: Persist; target: PeekTarget; back?: () => void; close: () => void }) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !editing) close() }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [close, editing])
  const go = (path: string) => { close(); navigate(`/local/campaign/${campaign.id}/${path}`) }
  const entityName = (id: string) => campaign.entities.find((item) => item.id === id)?.name
  const entities = (ids: string[]) => ids.flatMap((id) => { const name = entityName(id); return name ? [{ target: { kind: 'entity' as const, id }, name }] : [] })
  const found = (() => {
    if (target.kind === 'entity') {
      const entity = campaign.entities.find((item) => item.id === target.id)
      if (!entity) return null
      const usages = entityUsages(campaign, entity.id)
      return {
        kicker: ENTITY_LABEL[entity.type], title: entity.name,
        badges: [entity.visibility === 'public' ? 'Для игроков' : 'Только ведущим', ...(entity.status !== 'active' ? [ENTITY_STATUS_LABEL[entity.status]] : []), ...(entity.dead ? ['Погиб'] : [])],
        body: <>
          <p>{entity.description || <span className="muted">Описание пока не добавлено.</span>}</p>
          <EntityDetails entity={entity} className="peek-fields" />
          {entity.tags.length > 0 && <p className="row">{entity.tags.map((tag) => <Badge size="sm" key={tag}>#{tag}</Badge>)}</p>}
          <SourceLinks campaign={campaign} entity={entity} persist={persist} />
          {usages.relations.length > 0 && <PeekSection title="Связи"><ul>{usages.relations.map((relation) => { const other = relation.fromId === entity.id ? relation.toId : relation.fromId; return <li key={relation.id}>{RELATION_LABEL[relation.type]}{relation.direction === 'directed' ? (relation.fromId === entity.id ? ' → ' : ' ← ') : ' ↔ '}<PeekLink target={{ kind: 'entity', id: other }}>{entityName(other) ?? 'удалена'}</PeekLink>{relation.label && <small> · {relation.label}</small>}</li> })}</ul></PeekSection>}
          {(usages.clocks.length > 0 || usages.secrets.length > 0) && <PeekSection title="Часы и секреты"><PeekList items={[...usages.clocks.map((clock) => ({ target: { kind: 'clock' as const, id: clock.id }, name: `Часы «${clock.title}»` })), ...usages.secrets.map((secret) => ({ target: { kind: 'secret' as const, id: secret.id }, name: `Секрет «${secret.title}»` }))]} /></PeekSection>}
          {usages.plans.length > 0 && <PeekSection title="В планах сессий"><PeekList items={usages.plans.filter((usage) => !usage.trashed).map((usage) => ({ target: { kind: 'session' as const, id: usage.sessionId }, name: `№${usage.sessionNumber} ${usage.sessionTitle}` }))} /></PeekSection>}
          <small className="muted">{originLabel(entity, campaign)}</small>
        </>,
        actions: <><Button size="sm" icon="pencil" onClick={() => setEditing(true)}>Редактировать</Button><Button size="sm" variant="primary" icon="arrow-up-right" onClick={() => go(`entity/${entity.id}`)}>Открыть полностью</Button></>,
      }
    }
    if (target.kind === 'clock') {
      const clock = campaign.clocks.find((item) => item.id === target.id)
      if (!clock) return null
      const arc = campaign.storyArcs.find((item) => item.id === clock.arcId)
      return {
        kicker: 'Часы', title: clock.title, badges: [`${clock.value}/${clock.segments}`, clock.visibility === 'public' ? 'Для игроков' : 'Только ведущим'],
        body: <>
          <div className="peek-meter" aria-label={`Заполнено ${clock.value} из ${clock.segments}`}>{Array.from({ length: clock.segments }, (_, index) => <i key={index} className={index < clock.value ? 'on' : ''} />)}</div>
          <dl className="peek-fields">{[['Срабатывание', clock.trigger], ['Продвигается', clock.advanceCondition], ['Откатывается', clock.rollbackCondition]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {clock.thresholds.length > 0 && <PeekSection title="Пороги"><ul>{clock.thresholds.map((threshold) => <li key={threshold.id}>{threshold.at}: {threshold.consequence}{threshold.reachedAt ? ' ✓' : ''}</li>)}</ul></PeekSection>}
          <PeekSection title="Связано"><PeekList items={[...(arc ? [{ target: { kind: 'arc' as const, id: arc.id }, name: `Линия «${arc.title}»` }] : []), ...entities(clock.entityIds), ...clock.secretIds.flatMap((id) => { const secret = campaign.secrets.find((item) => item.id === id); return secret ? [{ target: { kind: 'secret' as const, id }, name: `Секрет «${secret.title}»` }] : [] })]} /></PeekSection>
        </>,
        actions: <Button size="sm" variant="primary" icon="arrow-up-right" onClick={() => go('control?tab=clocks')}>Открыть в пульте</Button>,
      }
    }
    if (target.kind === 'secret') {
      const secret = campaign.secrets.find((item) => item.id === target.id)
      if (!secret) return null
      return {
        kicker: 'Секрет', title: secret.title, badges: [SECRET_STATUS[secret.status]],
        body: <>
          <dl className="peek-fields">{[['Правда', secret.truth], ['Для игроков', secret.publicVersion], ['Условие раскрытия', secret.revealCondition], ['Знают', recipientsLabel(campaign, secret.recipientIds, secret.recipients)]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <PeekSection title="Связано"><PeekList items={[...entities(secret.entityIds), ...secret.clockIds.flatMap((id) => { const clock = campaign.clocks.find((item) => item.id === id); return clock ? [{ target: { kind: 'clock' as const, id }, name: `Часы «${clock.title}»` }] : [] }), ...secret.sessionIds.flatMap((id) => { const session = liveSessions(campaign).find((item) => item.id === id); return session ? [{ target: { kind: 'session' as const, id }, name: `Сессия №${session.number}` }] : [] })]} /></PeekSection>
        </>,
        actions: <Button size="sm" variant="primary" icon="arrow-up-right" onClick={() => go('control?tab=secrets')}>Открыть в пульте</Button>,
      }
    }
    if (target.kind === 'arc') {
      const arc = campaign.storyArcs.find((item) => item.id === target.id)
      if (!arc) return null
      const clocks = campaign.clocks.filter((clock) => clock.arcId === arc.id)
      return {
        kicker: arc.mode === 'background' ? 'Фоновая линия' : 'Линия', title: arc.title, badges: [ARC_STATUS[arc.status], `${arc.progress}%`],
        body: <>
          <dl className="peek-fields">{[['Направление', arc.direction], ['Ставки', arc.stakes], ['Владелец', arc.owner], ['Причина', arc.statusReason]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {clocks.length > 0 && <PeekSection title="Часы линии"><PeekList items={clocks.map((clock) => ({ target: { kind: 'clock' as const, id: clock.id }, name: clock.title }))} /></PeekSection>}
        </>,
        actions: <Button size="sm" variant="primary" icon="arrow-up-right" onClick={() => go('arcs')}>Открыть в сюжете</Button>,
      }
    }
    if (target.kind === 'player') {
      const player = campaign.players.find((item) => item.id === target.id)
      if (!player) return null
      const groups = campaign.groups.filter((group) => group.playerIds.includes(player.id))
      return {
        kicker: 'Игрок', title: player.name, badges: groups.map((group) => group.name),
        body: <>
          {player.note && <p>{player.note}</p>}
          <PeekSection title="Персонажи"><PeekList items={entities(player.characterIds)} empty="Пока нет" /></PeekSection>
        </>,
        actions: <>{player.profileId && <Button size="sm" icon="user-round" onClick={() => { close(); navigate(`/players?open=${player.profileId}`) }}>Профиль игрока</Button>}<Button size="sm" variant="primary" icon="arrow-up-right" onClick={() => go('team')}>Открыть в команде</Button></>,
      }
    }
    const session = campaign.sessionRecords.find((item) => item.id === target.id)
    if (!session) return null
    const scenes = session.planItems.filter((item) => item.kind === 'scene')
    return {
      kicker: `Сессия №${session.number}`, title: session.title, badges: [SESSION_STATUS[session.status], ...(session.date ? [new Date(`${session.date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })] : []), `Ведёт: ${masterName(campaign, session.masterId)}`],
      body: <>
        <p>{session.focus || session.idea || <span className="muted">Фокус пока не задан.</span>}</p>
        {scenes.length > 0 && <PeekSection title="Сцены"><ul>{scenes.map((scene) => <li key={scene.id}>{scene.text || entityName(scene.entityId ?? '') || 'Сцена'}</li>)}</ul></PeekSection>}
        <small className="muted">Пунктов плана: {session.planItems.length} · записей журнала: {session.log.length}</small>
      </>,
      actions: session.deletedAt ? <small className="muted">Сессия в корзине</small> : <Button size="sm" variant="primary" icon="arrow-up-right" onClick={() => { persist({ ...campaign, activeSessionId: session.id }); go('session') }}>Открыть сессию</Button>,
    }
  })()
  const entity = target.kind === 'entity' ? campaign.entities.find((item) => item.id === target.id) : undefined
  return <>
    <aside className="peek-drawer" role="complementary" aria-label={found ? `${found.kicker}: ${found.title}` : 'Запись'}>
      <header className="peek-drawer__head">
        {back ? <button type="button" className="peek-drawer__icon" onClick={back} aria-label="Назад"><Icon name="arrow-left" size={16} /></button> : <span />}
        <span className="panel-kicker">{found?.kicker ?? 'Запись'}</span>
        <button type="button" className="peek-drawer__icon" onClick={close} aria-label="Закрыть панель"><Icon name="x" size={16} /></button>
      </header>
      {found ? <>
        <h2>{found.title}</h2>
        {found.badges.length > 0 && <div className="row peek-drawer__badges">{found.badges.map((badge) => <Badge size="sm" key={badge}>{badge}</Badge>)}</div>}
        <div className="peek-drawer__body">{found.body}</div>
        <footer className="peek-drawer__actions">{found.actions}</footer>
      </> : <p className="muted">Запись удалена.</p>}
    </aside>
    {editing && entity && <EntityEditor campaign={campaign} persist={persist} entity={entity} close={() => setEditing(false)} />}
  </>
}

function PeekSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="peek-section"><h3>{title}</h3><div>{children}</div></section>
}

/** Ctrl+K: every word of the query, across library, secrets, clocks, arcs, sessions, plans and players. */
function SearchPalette({ campaign, close }: { campaign: LocalCampaignRecord; close: () => void }) {
  const peek = usePeek()!
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  const hits = searchCampaign(campaign, query)
  const choose = (hit: SearchHit | undefined) => { if (hit) peek.open(hit.target) }
  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.stopPropagation(); close() }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(Math.min(active + 1, hits.length - 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive(Math.max(active - 1, 0)) }
    if (event.key === 'Enter') choose(hits[active])
  }
  let group = ''
  return <div className="campaign-workspace__scrim search-palette__scrim" onMouseDown={(event) => { if (event.currentTarget === event.target) close() }}>
    <section className="search-palette" role="dialog" aria-modal="true" aria-label="Поиск по кампании" onKeyDown={onKey}>
      <div className="search-palette__field"><Icon name="search" size={18} /><input ref={input} value={query} aria-label="Что ищем" placeholder="Имя, место, секрет, сцена…" onChange={(event) => { setQuery(event.target.value); setActive(0) }} /><kbd>Esc</kbd></div>
      {query.trim() ? hits.length ? <ul className="search-palette__list" role="listbox" aria-label="Найдено">{hits.map((hit, index) => {
        const heading = hit.kind !== group ? SEARCH_GROUP[hit.kind] : null
        group = hit.kind
        return <li key={`${hit.kind}:${hit.id}`} role="presentation">{heading && <span className="search-palette__group">{heading}</span>}<button type="button" role="option" aria-selected={index === active} className={index === active ? 'active' : ''} onMouseEnter={() => setActive(index)} onClick={() => choose(hit)}><strong>{hit.title}</strong>{hit.detail && <small>{hit.detail}</small>}</button></li>
      })}</ul> : <p className="muted search-palette__empty">Ничего не нашли.</p> : <p className="muted search-palette__empty">Ищет по библиотеке, секретам, часам, линиям, сессиям, пунктам планов и игрокам. ↑↓ — выбрать, Enter — открыть.</p>}
    </section>
  </div>
}
