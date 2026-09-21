import { Link } from 'react-router-dom'
import type { LocalCampaignRecord } from '../fixtures/localCampaignCatalog'
import { entitySceneReferences } from '../lib/localEntityDetails'
import { sessionPath } from '../lib/localSessions'

export function LocalEntityReferences({ campaign, entityId }: { campaign: LocalCampaignRecord; entityId: string }) {
  const scenes = entitySceneReferences(campaign, entityId)
  const relations = campaign.relations.filter((relation) => relation.fromId === entityId || relation.toId === entityId)
  if (!scenes.length && !relations.length) return null
  return <details><summary>Где используется · {scenes.length + relations.length}</summary>
    <ul>{scenes.map((ref) => <li key={`${ref.sessionId}:${ref.sceneId}`}>
      {ref.deleted ? `${ref.sessionTitle} · ${ref.sceneTitle} (сессия в корзине)` : <Link to={sessionPath(campaign, 'session', ref.sessionId)}>{ref.sessionTitle} · {ref.sceneTitle}</Link>}
    </li>)}{relations.map((relation) => <li key={relation.id}>
      {campaign.entities.find((entity) => entity.id === (relation.fromId === entityId ? relation.toId : relation.fromId))?.name ?? 'Неизвестный объект'} · {relation.label}
    </li>)}</ul>
  </details>
}
