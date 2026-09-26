import { ENTITY_FIELDS } from '../../local/domain'
import type { LocalCampaignEntity } from '../../local/types'

/** Fields from another system that have no slot in this type keep their label as the key. */
export const extraFields = (entity: Pick<LocalCampaignEntity, 'type' | 'fields'>): Array<[string, string]> =>
  Object.entries(entity.fields).filter(([key, value]) => value && !ENTITY_FIELDS[entity.type].some((field) => field.id === key))

/** Filled card fields of an entity, shared by the library, the live table and print. */
export function EntityDetails({ entity, className, fate = true }: { entity: LocalCampaignEntity; className: string; /** Off where a badge already says the NPC is dead. */ fate?: boolean }) {
  const rows: Array<[string, string]> = [
    ...ENTITY_FIELDS[entity.type].filter((field) => entity.fields[field.id]).map((field): [string, string] => [field.label, entity.fields[field.id]]),
    ...extraFields(entity),
    ...(fate && entity.type === 'npc' && entity.dead ? [['Судьба', 'Погиб'] as [string, string]] : []),
  ]
  if (!rows.length) return null
  return <dl className={className}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}
