import { useState } from 'react'
import { Button, Select } from '../../ds'
import { ENTITY_FIELDS, ENTITY_STATUS_LABEL, extraFields, newEntity } from '../../local/domain'
import type { LocalCampaignEntity, LocalCampaignEntityType, LocalCampaignRecord } from '../../local/types'
import { ENTITY_TYPES, Editor } from './shared'

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
    const saved: LocalCampaignEntity = { ...draft, name: draft.name.trim(), description: draft.description.trim(), fields, tags: draft.tags.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean), id: entity === 'new' ? `entity-${crypto.randomUUID()}` : entity.id }
    persist({ ...campaign, entities: entity === 'new' ? [...campaign.entities, saved] : campaign.entities.map((item) => item.id === saved.id ? saved : item) })
    if (entity === 'new') onCreated?.(saved)
    close()
  }
  const remove = (id: string) => persist({
    ...campaign,
    entities: campaign.entities.filter((item) => item.id !== id),
    relations: campaign.relations.filter((relation) => relation.fromId !== id && relation.toId !== id),
    clocks: campaign.clocks.map((clock) => ({ ...clock, entityIds: clock.entityIds.filter((item) => item !== id) })),
    secrets: campaign.secrets.map((secret) => ({ ...secret, entityIds: secret.entityIds.filter((item) => item !== id) })),
  })
  return <Editor title={entity === 'new' ? 'Новая сущность' : 'Редактировать сущность'} close={close}>
      <div className="control-form__row"><label htmlFor="local-entity-type">Тип<Select id="local-entity-type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as LocalCampaignEntityType })}>{ENTITY_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label><label htmlFor="local-entity-name">Название<input id="local-entity-name" autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label></div>
      <label htmlFor="local-entity-description">Рабочее описание<textarea id="local-entity-description" rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      {ENTITY_FIELDS[draft.type].length > 0 && <div className="control-form__row">{ENTITY_FIELDS[draft.type].map((field) => <label key={field.id} htmlFor={`local-entity-field-${field.id}`}>{field.label}<input id={`local-entity-field-${field.id}`} value={draft.fields[field.id] ?? ''} onChange={(event) => setDraft({ ...draft, fields: { ...draft.fields, [field.id]: event.target.value } })} /></label>)}</div>}
      <label htmlFor="local-entity-tags">Теги<input id="local-entity-tags" value={draft.tags.join(', ')} placeholder="важное, первая сессия" onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(',') })} /></label>
      <div className="control-form__row"><label htmlFor="local-entity-visibility">Видимость<select id="local-entity-visibility" value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as LocalCampaignEntity['visibility'] })}><option value="master">Только ведущим</option><option value="public">Для игроков</option></select></label><label htmlFor="local-entity-status">Состояние<select id="local-entity-status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as LocalCampaignEntity['status'] })}>{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <footer>{entity !== 'new' && <Button tone="danger" onClick={() => { remove(entity.id); close() }}>Удалить</Button>}<Button onClick={close}>Отмена</Button><Button variant="primary" icon="check" disabled={!draft.name.trim()} onClick={save}>Сохранить</Button></footer>
  </Editor>
}
