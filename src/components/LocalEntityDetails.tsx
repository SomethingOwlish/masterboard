import type { LocalCampaignEntity } from '../fixtures/localCampaignCatalog'

/** The library, game table and print sheet read the same live entity data. */
export function LocalEntityDetails({ entity }: { entity: LocalCampaignEntity }) {
  return <div className="local-entity-details">
    {entity.type === 'character' && entity.playerName && <p>Игрок: {entity.playerName}</p>}
    {entity.type === 'npc' && <p>{entity.dead ? 'Погиб' : 'Жив'}</p>}
    <p>{entity.description || 'Описание пока не добавлено.'}</p>
    {!!entity.fields?.length && <dl>{entity.fields.map((field) => <div key={field.id}>
      <dt>{field.label || 'Без названия'}</dt><dd>{field.value || '—'}</dd>
    </div>)}</dl>}
  </div>
}
