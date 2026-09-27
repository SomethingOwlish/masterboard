import { useState } from 'react'
import { Badge, Button, Icon, Select } from '../../ds'
import { addTags, addToPlan, exportEntities, relateTo, removeTags, sendTo, setField, setStatus, setType, setVisibility } from '../../local/bulk'
import { ENTITY_FIELDS, ENTITY_STATUS_LABEL, entityUsages, usageCount, type EntityFilter } from '../../local/domain'
import { downloadText } from '../../local/download'
import { ROLE_LABEL, SYSTEM_LABEL, WRITABLE_ROLES, entityRoles, linkedRole, type WritableRole } from '../../local/integration'
import { RELATION_TYPE } from '../../local/sessionFlow'
import { liveSessions } from '../../local/sessions'
import type { LocalCampaignEntity, LocalCampaignEntityType, LocalCampaignRecord, LocalRelationType } from '../../local/types'
import { PeekLink } from './Peek'
import { ENTITY_LABEL, ENTITY_TYPES, type Persist } from './shared'

type Sort = NonNullable<EntityFilter['sort']>

/**
 * The library as a table (ТЗ-2, R7 B): pick rows, «all found», sort by a
 * column; the bar below acts on every picked entity at once.
 */
export function LibraryTable({ campaign, persist, entities, sort, setSort }: { campaign: LocalCampaignRecord; persist: Persist; entities: LocalCampaignEntity[]; sort: Sort; setSort: (sort: Sort) => void }) {
  const [picked, setPicked] = useState<string[]>([])
  const shown = new Set(entities.map((entity) => entity.id))
  const chosen = picked.filter((id) => shown.has(id))
  const all = entities.length > 0 && chosen.length === entities.length
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((item) => item !== id) : [...picked, id])
  const head = (label: string, by?: Sort) => <th scope="col" aria-sort={by && sort === by ? 'ascending' : undefined}>{by ? <button type="button" className={sort === by ? 'active' : ''} onClick={() => setSort(sort === by ? 'added' : by)}>{label}{sort === by && <Icon name="chevron-down" size={12} />}</button> : label}</th>
  return <>
    <div className="library-table__wrap"><table className="library-table" aria-label="Библиотека таблицей">
      <thead><tr><th scope="col" className="library-table__pick"><input type="checkbox" aria-label="Выбрать все найденные" checked={all} onChange={() => setPicked(all ? picked.filter((id) => !shown.has(id)) : [...new Set([...picked, ...shown])])} /></th>{head('Название', 'name')}{head('Тип', 'type')}{head('Теги')}{head('Видимость')}{head('Состояние')}{head('Где хранится')}{head('Используется', 'used')}</tr></thead>
      <tbody>{entities.map((entity) => {
        const places = entityRoles(campaign, entity).map((role) => SYSTEM_LABEL[linkedRole(campaign, role)!.system])
        const from = [...new Set(entity.sources.map((source) => SYSTEM_LABEL[source.system]))]
        return <tr key={entity.id} className={chosen.includes(entity.id) ? 'picked' : entity.status === 'archived' ? 'archived' : ''}>
          <td className="library-table__pick"><input type="checkbox" aria-label={`Выбрать: ${entity.name}`} checked={chosen.includes(entity.id)} onChange={() => toggle(entity.id)} /></td>
          <td><PeekLink target={{ kind: 'entity', id: entity.id }}>{entity.name}</PeekLink>{entity.dead && <small> · погиб</small>}</td>
          <td>{ENTITY_LABEL[entity.type]}</td>
          <td>{entity.tags.map((tag) => `#${tag}`).join(' ') || <span className="muted">—</span>}</td>
          <td>{entity.visibility === 'public' ? 'Для игроков' : 'Только ведущим'}</td>
          <td>{ENTITY_STATUS_LABEL[entity.status]}</td>
          <td>{[...new Set([...places, ...from])].join(', ') || <span className="muted">здесь</span>}</td>
          <td className="library-table__num">{usageCount(entityUsages(campaign, entity.id)) || ''}</td>
        </tr>
      })}</tbody>
    </table></div>
    {chosen.length > 0 && <BulkBar campaign={campaign} persist={persist} ids={chosen} clear={() => setPicked([])} />}
  </>
}

type Action = 'tags' | 'visibility' | 'status' | 'field' | 'send' | 'plan' | 'relate'
const ACTIONS: Array<[Action, string]> = [['tags', 'Теги'], ['visibility', 'Видимость'], ['status', 'Архив'], ['field', 'Поле'], ['send', 'Отправить'], ['plan', 'В план сессии'], ['relate', 'Связать']]

/** Actions over the picked rows: one form at a time, each applies to all of them in one write. */
function BulkBar({ campaign, persist, ids, clear }: { campaign: LocalCampaignRecord; persist: Persist; ids: string[]; clear: () => void }) {
  const [action, setAction] = useState<Action | null>(null)
  const [text, setText] = useState('')
  const [value, setValue] = useState('')
  const [roles, setRoles] = useState<WritableRole[]>([])
  const [relType, setRelType] = useState<LocalRelationType>('belongs')
  const [done, setDone] = useState<string | null>(null)
  const picked = campaign.entities.filter((entity) => ids.includes(entity.id))
  const types = [...new Set(picked.map((entity) => entity.type))]
  const fieldChoices = [{ key: '__type', label: 'Тип' }, ...(types.length === 1 ? ENTITY_FIELDS[types[0]].map((field) => ({ key: field.id, label: field.label })) : []), ...[...new Set(picked.flatMap((entity) => Object.keys(entity.fields).filter((key) => !ENTITY_FIELDS[entity.type].some((field) => field.id === key))))].map((key) => ({ key, label: key }))]
  const linkedRoles = WRITABLE_ROLES.filter((role) => linkedRole(campaign, role))
  const sessions = liveSessions(campaign).filter((session) => session.status !== 'completed')
  const others = campaign.entities.filter((entity) => !ids.includes(entity.id) && entity.status !== 'archived')
  const apply = (next: LocalCampaignRecord, message: string) => { persist(next); setDone(message); setAction(null); setText(''); setValue('') }
  const now = () => new Date().toISOString()
  const open = (next: Action) => { setAction(action === next ? null : next); setDone(null); setText(''); setValue(next === 'field' ? '__type' : next === 'plan' ? sessions[0]?.id ?? '' : next === 'relate' ? others[0]?.id ?? '' : ''); setRoles(linkedRoles) }
  return <div className="bulk-bar" role="region" aria-label="Действия с выбранными">
    <div className="bulk-bar__row">
      <strong>Выбрано: {ids.length}</strong>
      {ACTIONS.map(([id, label]) => <Button key={id} size="sm" variant={action === id ? 'primary' : undefined} aria-pressed={action === id} onClick={() => open(id)}>{label}</Button>)}
      <Button size="sm" icon="download" onClick={() => downloadText(`${campaign.name.replace(/[^\p{L}\p{N}]+/gu, '-')}-сущности.json`, exportEntities(campaign, ids, now()))}>Экспорт</Button>
      <button type="button" className="bulk-bar__clear" onClick={clear} aria-label="Снять выбор"><Icon name="x" size={16} /></button>
    </div>
    {action === 'tags' && <form className="bulk-bar__form" onSubmit={(event) => event.preventDefault()}><input aria-label="Теги для выбранных" value={text} placeholder="важное, порт" onChange={(event) => setText(event.target.value)} /><Button size="sm" disabled={!text.trim()} onClick={() => apply(addTags(campaign, ids, text.split(',')), `Теги добавлены: ${ids.length}`)}>Добавить</Button><Button size="sm" disabled={!text.trim()} onClick={() => apply(removeTags(campaign, ids, text.split(',')), `Теги убраны: ${ids.length}`)}>Убрать</Button></form>}
    {action === 'visibility' && <div className="bulk-bar__form"><Button size="sm" onClick={() => apply(setVisibility(campaign, ids, 'master'), 'Теперь только ведущим')}>Только ведущим</Button><Button size="sm" onClick={() => apply(setVisibility(campaign, ids, 'public'), 'Теперь для игроков')}>Для игроков</Button></div>}
    {action === 'status' && <div className="bulk-bar__form"><Button size="sm" onClick={() => apply(setStatus(campaign, ids, 'archived'), `В архиве: ${ids.length}`)}>В архив</Button><Button size="sm" onClick={() => apply(setStatus(campaign, ids, 'active'), `Возвращены: ${ids.length}`)}>Из архива</Button><Button size="sm" onClick={() => apply(setStatus(campaign, ids, 'inactive'), `Неактивны: ${ids.length}`)}>Неактивные</Button></div>}
    {action === 'field' && <form className="bulk-bar__form" onSubmit={(event) => event.preventDefault()}><Select aria-label="Какое поле" value={value} onChange={(event) => { setValue(event.target.value); setText('') }}>{fieldChoices.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</Select>{value === '__type' ? <Select aria-label="Новый тип" value={text || types[0]} onChange={(event) => setText(event.target.value)}>{ENTITY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</Select> : <input aria-label="Значение поля" value={text} placeholder="Пусто — очистить" onChange={(event) => setText(event.target.value)} />}<Button size="sm" onClick={() => apply(value === '__type' ? setType(campaign, ids, (text || types[0]) as LocalCampaignEntityType) : setField(campaign, ids, value, text), `Изменено: ${ids.length}`)}>Применить к {ids.length}</Button></form>}
    {action === 'send' && (linkedRoles.length ? <div className="bulk-bar__form">{linkedRoles.map((role) => <label key={role} className={`home-chip${roles.includes(role) ? ' on' : ''}`}><input type="checkbox" checked={roles.includes(role)} onChange={() => setRoles(roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role])} />{ROLE_LABEL[role]} · {SYSTEM_LABEL[linkedRole(campaign, role)!.system]}</label>)}<Button size="sm" onClick={() => apply(sendTo(campaign, ids, null, now()), 'В очереди «Публикации» по правилам')}>По правилам</Button><Button size="sm" variant="primary" disabled={!roles.length} onClick={() => apply(sendTo(campaign, ids, roles, now()), 'В очереди «Публикации»')}>В выбранные</Button></div> : <p className="muted bulk-bar__form">Кампания не подключена к миру или столу — это делается в «Интеграциях».</p>)}
    {action === 'plan' && (sessions.length ? <div className="bulk-bar__form"><Select aria-label="В какую сессию" value={value} onChange={(event) => setValue(event.target.value)}>{sessions.map((session) => <option key={session.id} value={session.id}>№{session.number} {session.title}</option>)}</Select><Button size="sm" onClick={() => apply(addToPlan(campaign, ids, value), 'Добавлено в план')}>Добавить в план</Button></div> : <p className="muted bulk-bar__form">Нет сессий в подготовке.</p>)}
    {action === 'relate' && (others.length ? <form className="bulk-bar__form" onSubmit={(event) => event.preventDefault()}><Select aria-label="С кем связать" value={value} onChange={(event) => setValue(event.target.value)}>{others.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {ENTITY_LABEL[entity.type]}</option>)}</Select><Select aria-label="Вид связи" value={relType} onChange={(event) => setRelType(event.target.value as LocalRelationType)}>{Object.entries(RELATION_TYPE).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select><input aria-label="Подпись связи" value={text} placeholder="Подпись" onChange={(event) => setText(event.target.value)} /><Button size="sm" onClick={() => apply(relateTo(campaign, ids, value, relType, text), 'Связи добавлены')}>Связать</Button></form> : <p className="muted bulk-bar__form">Не с чем связать.</p>)}
    {done && <p className="bulk-bar__done" role="status"><Badge size="sm" tone="success">{done}</Badge></p>}
  </div>
}
