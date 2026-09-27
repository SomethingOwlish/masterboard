import { useState } from 'react'
import { Button, Select } from '../../ds'
import { ENTITY_FIELDS, ENTITY_STATUS_LABEL, blockingPlans, entityUsages, newEntity, removeEntity, retypeEntity } from '../../local/domain'
import { extraFields } from './EntityDetails'
import type { LocalCampaignEntity, LocalCampaignEntityType, LocalCampaignRecord } from '../../local/types'
import { ENTITY_TYPES, Editor } from './shared'
import { ROLE_LABEL, SYSTEM_LABEL, WRITABLE_ROLES, entityRoles, linkedRole, rulesFor } from '../../local/integration'
import { enqueueByRoles } from '../../local/publishing'
import { baseFields } from '../../local/bulk'
import { useBaseSchema } from '../../local/useExternal'

type Draft = Omit<LocalCampaignEntity, 'id'>
const STATUS_LABEL = ENTITY_STATUS_LABEL
/**
 * Create or edit a library entity. Used by the library section and, for a
 * library record placed in a session plan, by the plan itself: the edit goes
 * to the record, so every session that uses it sees it.
 */
export function EntityEditor({ campaign, persist, entity, defaultType = 'npc', close, onCreated }: { campaign: LocalCampaignRecord; persist: (next: LocalCampaignRecord) => void; entity: LocalCampaignEntity | 'new'; defaultType?: LocalCampaignEntityType; close: () => void; onCreated?: (entity: LocalCampaignEntity) => void }) {
  const [draft, setDraft] = useState<Draft>(() => { const { id: _id, ...rest } = entity === 'new' ? newEntity({ type: defaultType, name: '' }) : entity; return rest })
  const save = () => {
    if (!draft.name.trim()) return
    const fields = Object.fromEntries([...ENTITY_FIELDS[draft.type].map((field) => [field.id, draft.fields[field.id]?.trim() ?? '']), ...extraFields(draft)].filter(([, value]) => value))
    const { dead: _dead, ...rest } = draft
    const saved: LocalCampaignEntity = { ...rest, ...(draft.type === 'npc' && draft.dead ? { dead: true } : {}), name: draft.name.trim(), description: draft.description.trim(), fields, tags: draft.tags.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean), id: entity === 'new' ? `entity-${crypto.randomUUID()}` : entity.id }
    const next = { ...campaign, entities: entity === 'new' ? [...campaign.entities, saved] : campaign.entities.map((item) => item.id === saved.id ? saved : item) }
    persist(entityRoles(next, saved).length ? enqueueByRoles(next, saved.id, new Date().toISOString()) : next)
    if (entity === 'new') onCreated?.(saved)
    close()
  }
  const planned = entity === 'new' ? 0 : blockingPlans(entityUsages(campaign, entity.id)).length
  return <Editor title={entity === 'new' ? 'Новая сущность' : 'Редактировать сущность'} close={close} draft={draft} size="xl">
      <div className="control-form__row"><label htmlFor="local-entity-type">Тип<Select id="local-entity-type" value={draft.type} onChange={(event) => setDraft(retypeEntity(draft, event.target.value as LocalCampaignEntityType))}>{ENTITY_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label><label htmlFor="local-entity-name">Название<input id="local-entity-name" autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label></div>
      <label htmlFor="local-entity-description">Рабочее описание<textarea className="auto-grow" id="local-entity-description" rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      {ENTITY_FIELDS[draft.type].length > 0 && <div className="entity-fields">{ENTITY_FIELDS[draft.type].map((field) => <label key={field.id} htmlFor={`local-entity-field-${field.id}`}>{field.label}<textarea className="auto-grow" rows={1} id={`local-entity-field-${field.id}`} value={draft.fields[field.id] ?? ''} onChange={(event) => setDraft({ ...draft, fields: { ...draft.fields, [field.id]: event.target.value } })} /></label>)}</div>}
      <BaseFieldsBlock campaign={campaign} draft={draft} setDraft={setDraft} />
      <label htmlFor="local-entity-tags">Теги<input id="local-entity-tags" value={draft.tags.join(', ')} placeholder="важное, первая сессия" onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(',') })} /></label>
      <div className="control-form__row"><label htmlFor="local-entity-visibility">Видимость<select id="local-entity-visibility" value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as LocalCampaignEntity['visibility'] })}><option value="master">Только ведущим</option><option value="public">Для игроков</option></select></label><label htmlFor="local-entity-status">Состояние<select id="local-entity-status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as LocalCampaignEntity['status'] })}>{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <HomeChips campaign={campaign} draft={draft} setDraft={setDraft} />
      {draft.type === 'npc' && <label className="campaign-local-library__dead"><input type="checkbox" checked={Boolean(draft.dead)} onChange={(event) => setDraft({ ...draft, dead: event.target.checked })} /> Персонаж погиб</label>}
      <footer>
        {entity !== 'new' && (
          <Button
            tone="danger"
            disabled={planned > 0}
            title={planned ? `Используется в планах сессий (${planned}) — уберите из планов или отправьте в архив` : undefined}
            onClick={() => { persist(removeEntity(campaign, entity.id)); close() }}
          >
            Удалить
          </Button>
        )}
        <Button onClick={close}>Отмена</Button>
        <Button variant="primary" icon="check" disabled={!draft.name.trim()} onClick={save}>Сохранить</Button>
      </footer>
  </Editor>
}

/**
 * «Где хранить» (ТЗ-2, R3): only here, or also in the campaign's world / table.
 * Starts from the type's rule; a choice here is the entity's own. On save the
 * entity is queued for every place — sending stays in «Публикации».
 */
function HomeChips({ campaign, draft, setDraft }: { campaign: LocalCampaignRecord; draft: Draft; setDraft: (next: Draft) => void }) {
  const roles = WRITABLE_ROLES.filter((role) => linkedRole(campaign, role))
  if (!roles.length) return null
  const chosen = draft.destinations ?? rulesFor(campaign, draft.type)
  const set = (next: Array<'world' | 'table'>) => setDraft({ ...draft, destinations: next })
  return <fieldset className="home-chips"><legend>Где хранить{draft.destinations ? '' : ' · по правилу типа'}</legend>
    <label className={`home-chip${chosen.filter((role) => roles.includes(role)).length ? '' : ' on'}`}><input type="checkbox" checked={!chosen.some((role) => roles.includes(role))} onChange={() => set([])} />Только здесь</label>
    {roles.map((role) => { const linked = linkedRole(campaign, role)!; const on = chosen.includes(role); return <label key={role} className={`home-chip${on ? ' on' : ''}`}><input type="checkbox" checked={on} onChange={() => set(on ? chosen.filter((item) => item !== role) : [...chosen, role])} />{ROLE_LABEL[role]} · {SYSTEM_LABEL[linked.system]}</label> })}
    {draft.destinations && <button type="button" className="home-chips__reset" onClick={() => { const { destinations: _drop, ...rest } = draft; setDraft(rest) }}>По правилу</button>}
  </fieldset>
}

/**
 * «Из основы» (ТЗ-2, R2 C): fields the campaign's world, table and system use
 * for this type, plus any field an imported record brought along.
 */
function BaseFieldsBlock({ campaign, draft, setDraft }: { campaign: LocalCampaignRecord; draft: Draft; setDraft: (next: Draft) => void }) {
  const schema = useBaseSchema(campaign, draft.type)
  const declared = baseFields(campaign, draft.type, schema)
  const carried = extraFields(draft).filter(([key]) => !declared.some((field) => field.key === key)).map(([key]) => ({ key, label: key, long: false, from: '' }))
  const fields = [...declared, ...carried]
  if (!fields.length) return null
  const from = [...new Set(declared.map((field) => field.from).filter(Boolean))].map((system) => SYSTEM_LABEL[system as keyof typeof SYSTEM_LABEL] ?? system)
  return <fieldset className="entity-fields entity-fields--base"><legend>Из основы{from.length ? ` · ${from.join(', ')}` : ''}</legend>
    {fields.map((field, index) => <label key={field.key} htmlFor={`local-entity-base-${index}`} className={field.long ? 'wide' : ''}>{field.label}<textarea className="auto-grow" rows={field.long ? 3 : 1} id={`local-entity-base-${index}`} value={draft.fields[field.key] ?? ''} onChange={(event) => setDraft({ ...draft, fields: { ...draft.fields, [field.key]: event.target.value } })} /></label>)}
  </fieldset>
}
