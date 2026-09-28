import { useEffect, useState } from 'react'
import { Badge, Button, Icon, Select } from '../../ds'
import { REMOVED_HINT, ROLE_LABEL, SYSTEM_IN, SYSTEM_LABEL, connectionKey, linkedRole, parseConnectionKey, roleConnection, statusBadge, type CampaignRole, importItems, importType, planRefresh, resolveRefresh, type ExternalItem, type RefreshPlan } from '../../local/integration'
import type { EntitySource, LocalCampaignEntity, LocalCampaignRecord } from '../../local/types'
import { useConnections, useExternal } from '../../local/useExternal'
import { logImport } from '../../local/imports'
import { Editor, type Persist } from './shared'
import { ENTITY_LABEL, VISIBILITY_LABEL } from '../../local/labels'

const ROLES: CampaignRole[] = ['world', 'table', 'system']
const date = (value: string) => value ? new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
const show = (value: unknown) => Array.isArray(value) ? value.map((tag) => `#${tag}`).join(' ') || '—' : value === 'public' || value === 'master' ? VISIBILITY_LABEL[value] : String(value ?? '') || '—'

/** «Из SystemSetup» and a status worth a glance («К удалению» loudest), for a record or a link to it. */
function SourceMarks({ status, fromSystemsetup }: { status?: string; fromSystemsetup: boolean }) {
  const badge = statusBadge(status)
  return <>
    {fromSystemsetup && <Badge size="sm" tone="neutral" icon="book-open">Из SystemSetup</Badge>}
    {badge && <Badge size="sm" tone={badge.tone} title={status === 'removed' ? REMOVED_HINT : undefined}>{badge.label}</Badge>}
  </>
}

/** Sources a campaign can read from: its linked world / campaign and systemsetup (decision F2). */
function useSources(campaign: LocalCampaignRecord) {
  const state = useConnections()
  const linked = ROLES.flatMap((role) => { const found = linkedRole(campaign, role); if (!found) return []; const id = roleConnection(found.system, found.link); return [{ id, system: found.system, containerId: parseConnectionKey(id).externalId, only: found.link.connectionId ? found.link.externalId : undefined, label: `${ROLE_LABEL[role]} · ${SYSTEM_LABEL[found.system]} · ${found.link.label}` }] })
  // Without a linked system every SystemSetup pack stays readable, as before R1.
  const systems = linkedRole(campaign, 'system') || state.status !== 'ready' ? [] : state.connections.filter((item) => item.system === 'systemsetup').map((item) => ({ id: item.id, system: item.system, containerId: item.externalId, only: undefined, label: `${SYSTEM_LABEL.systemsetup} · ${item.label}` }))
  return { state, sources: [...linked, ...systems] }
}

/** «Из источника»: pick records in lorebook / lovegame / systemsetup and copy them into the library. */
/** `stay` keeps the dialog open after adding, to take records from several sources in turn (the base of a new campaign). */
export function ImportDialog({ campaign, persist, close, stay = false }: { campaign: LocalCampaignRecord; persist: Persist; close: () => void; stay?: boolean }) {
  const port = useExternal()
  const { state, sources } = useSources(campaign)
  const [sourceId, setSourceId] = useState('')
  const [items, setItems] = useState<ExternalItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [added, setAdded] = useState<string | null>(null)
  const source = sources.find((item) => item.id === sourceId) ?? sources[0]
  useEffect(() => {
    if (!source) return
    let alive = true
    setItems(null); setError(null); setChosen([])
    port.entities(source.id).then((found) => { if (alive) setItems(source.only ? found.filter((item) => item.id === source.only) : found) }, (failure: unknown) => { if (alive) { setItems([]); setError(failure instanceof Error ? failure.message : 'Не удалось прочитать записи') } })
    return () => { alive = false }
  }, [port, source?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const linked = new Set(source ? campaign.entities.flatMap((entity) => entity.sources.filter((item) => item.system === source.system && item.containerId === source.containerId).map((item) => item.id)) : [])
  const visible = (items ?? []).filter((item) => !query.trim() || item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const add = () => {
    if (!source || !items) return
    const result = importItems(campaign, source.system, source.containerId, items.filter((item) => chosen.includes(item.id)), new Date().toISOString())
    persist(logImport(result.campaign, source.label, 'records', result.added, new Date().toISOString()))
    if (!stay) { close(); return }
    setChosen([]); setAdded(`Добавлено в библиотеку: ${result.added} из «${source.label}».`)
  }
  return <Editor kicker="Мир · стол · система" title="Из источника" close={close}>
    {state.status === 'loading' && <p className="muted" role="status">Узнаём, какие источники вам доступны…</p>}
    {(state.status === 'unconfigured' || state.status === 'error') && <p className="local-session-error" role="alert">{state.status === 'unconfigured' ? 'Связь с внешними системами ещё не настроена на сервере Мастерборда.' : state.message}</p>}
    {state.status === 'ready' && !sources.length && <p className="muted">Кампания пока ни с чем не связана. Владелец подключает мир, стол и систему в разделе «Интеграции».</p>}
    {source && <>
      <div className="control-form__row"><label htmlFor="import-source">Откуда<Select id="import-source" value={source.id} onChange={(e) => setSourceId(e.target.value)}>{sources.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select></label><label htmlFor="import-query">Поиск<input id="import-query" value={query} placeholder="Название" onChange={(e) => setQuery(e.target.value)} /></label></div>
      {error && <p className="local-session-error" role="alert">{error}</p>}
      {added && <p className="muted" role="status">{added}</p>}
      {items && items.length > 1 && <label className="source-import__all"><input type="checkbox" checked={visible.every((item) => linked.has(item.id) || chosen.includes(item.id))} onChange={(event) => setChosen(event.target.checked ? [...new Set([...chosen, ...visible.filter((item) => !linked.has(item.id)).map((item) => item.id)])] : chosen.filter((id) => !visible.some((item) => item.id === id)))} /> Выбрать все{query.trim() ? ' найденные' : ''}</label>}
      {items === null ? <p className="muted" role="status">Читаем записи…</p> : visible.length ? <ul className="source-import__list" aria-label="Записи источника">{visible.map((item) => {
        const already = linked.has(item.id)
        return <li key={item.id}><label><input type="checkbox" disabled={already} checked={already || chosen.includes(item.id)} onChange={() => setChosen(chosen.includes(item.id) ? chosen.filter((id) => id !== item.id) : [...chosen, item.id])} /><span className="source-import__text"><strong>{item.name}</strong><small>{item.type} → {ENTITY_LABEL[importType(source.system, item.type)]}{item.visibility === 'master' ? ' · только мастерам' : ''}{item.archived ? ' · в архиве' : ''}</small></span><SourceMarks status={item.archived ? undefined : item.status} fromSystemsetup={item.source?.app === 'systemsetup'} />{already && <Badge size="sm" tone="neutral">уже в библиотеке</Badge>}</label></li>
      })}</ul> : !error && <p className="muted">{items.length ? 'Ничего не найдено.' : 'В источнике пока нет записей.'}</p>}
    </>}
    <footer><Button onClick={close}>{stay && added ? 'Готово' : 'Отмена'}</Button><Button variant="primary" icon="download" disabled={!chosen.length} onClick={add}>{chosen.length ? `Добавить ${chosen.length} в библиотеку` : 'Добавить в библиотеку'}</Button></footer>
  </Editor>
}

/** Where a clash is: the master picks Masterboard's or the source's value for each field. */
function ClashDialog({ plan, source, apply, close }: { plan: RefreshPlan; source: EntitySource; apply: (next: LocalCampaignEntity) => void; close: () => void }) {
  const [choices, setChoices] = useState<Record<string, 'mine' | 'theirs'>>({})
  const there = SYSTEM_LABEL[source.system]
  return <Editor kicker="Обновление из источника" title="Изменено с обеих сторон" close={close}>
    <p className="muted">Эти поля поменяли и здесь, и {SYSTEM_IN[source.system]}. Выберите, что оставить. {plan.changed.length ? `Остальное (${plan.changed.join(', ').toLocaleLowerCase()}) обновится из источника.` : ''}</p>
    {plan.clashes.map((clash) => <fieldset key={clash.key} className="source-clash"><legend>{clash.label}</legend>
      <label><input type="radio" name={clash.key} checked={choices[clash.key] === 'mine'} onChange={() => setChoices({ ...choices, [clash.key]: 'mine' })} /><span><small>Мастерборд</small>{show(clash.mine)}</span></label>
      <label><input type="radio" name={clash.key} checked={(choices[clash.key] ?? 'theirs') === 'theirs'} onChange={() => setChoices({ ...choices, [clash.key]: 'theirs' })} /><span><small>{there}</small>{show(clash.theirs)}</span></label>
    </fieldset>)}
    <p className="muted source-clash__note">Выбранное «Мастерборд» уйдёт в {there} со следующей публикацией.</p>
    <footer><Button onClick={close}>Отмена</Button><Button variant="primary" icon="check" onClick={() => { apply(resolveRefresh(plan, choices)); close() }}>Применить</Button></footer>
  </Editor>
}

/** Source links on a library card, with «Обновить из источника». */
export function SourceLinks({ campaign, entity, persist }: { campaign: LocalCampaignRecord; entity: LocalCampaignEntity; persist: Persist }) {
  const port = useExternal()
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [clash, setClash] = useState<{ plan: RefreshPlan; source: EntitySource } | null>(null)
  if (!entity.sources.length) return null
  const apply = (next: LocalCampaignEntity) => persist({ ...campaign, entities: campaign.entities.map((item) => item.id === entity.id ? next : item) })
  const refresh = async (source: EntitySource) => {
    setBusy(source.id); setNote(null)
    try {
      const { items, ids } = await port.listing(connectionKey(source.system, source.containerId), source.type)
      const item = items.find((candidate) => candidate.id === source.id)
      if (!item) {
        setNote(ids.includes(source.id)
          ? `Запись есть ${SYSTEM_IN[source.system]}, но прочитать её вам сейчас нельзя.`
          : `Этой записи больше нет ${SYSTEM_IN[source.system]}.`)
        return
      }
      const plan = planRefresh(entity, source, item, new Date().toISOString())
      if (plan.clashes.length) { setClash({ plan, source }); return }
      apply(plan.next)
      setNote(plan.changed.length ? `Обновлено: ${plan.changed.join(', ').toLocaleLowerCase()}.` : 'Изменений в источнике нет.')
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Не удалось прочитать источник')
    } finally {
      setBusy(null)
    }
  }
  return <div className="source-links">
    {entity.sources.map((source) => <div key={`${source.system}:${source.containerId}:${source.id}`} className="row">
      <Icon name="link" size={14} />{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{SYSTEM_LABEL[source.system]}</a> : <span>{SYSTEM_LABEL[source.system]}</span>}<SourceMarks status={source.status === 'archived' ? undefined : source.status} fromSystemsetup={source.from === 'systemsetup'} /><small>сверено {date(source.syncedAt)}</small>
      <Button size="sm" icon="refresh-cw" disabled={busy !== null} aria-label={`Обновить из источника: ${entity.name} (${SYSTEM_LABEL[source.system]})`} onClick={() => void refresh(source)}>{busy === source.id ? 'Читаем…' : 'Обновить'}</Button>
    </div>)}
    {entity.sources.some((source) => source.status === 'removed') && <small className="source-links__removed">{REMOVED_HINT}</small>}
    {note && <small role="status">{note}</small>}
    {clash && <ClashDialog plan={clash.plan} source={clash.source} apply={(next) => { apply(next); setNote('Обновлено с вашим выбором.') }} close={() => setClash(null)} />}
  </div>
}
