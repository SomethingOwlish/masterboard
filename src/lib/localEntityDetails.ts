import type { LocalCampaignEntity, LocalCampaignRecord } from '../fixtures/localCampaignCatalog'
import { syncLocalSessions } from './localSessions'

export function entitySceneReferences(campaign: LocalCampaignRecord, entityId: string) {
  return syncLocalSessions(campaign).sessionDocuments!.flatMap((session) => session.scenes
    .filter((scene) => scene.memberIds?.includes(entityId))
    .map((scene) => ({ sessionId: session.id, sessionTitle: session.title, sceneId: scene.id, sceneTitle: scene.title, deleted: !!session.deletedAt })))
}

export function validEntityDetails(entity: LocalCampaignEntity): boolean {
  if (entity.playerName !== undefined && typeof entity.playerName !== 'string') return false
  if (entity.dead !== undefined && typeof entity.dead !== 'boolean') return false
  if (entity.fields === undefined) return true
  if (!Array.isArray(entity.fields)) return false
  const ids = new Set<string>()
  return entity.fields.every((field) => {
    if (!field || typeof field.id !== 'string' || !field.id || ids.has(field.id) ||
      typeof field.label !== 'string' || typeof field.value !== 'string' ||
      !['text', 'number', 'longtext'].includes(field.type)) return false
    ids.add(field.id)
    return field.type !== 'number' || !field.value.trim() || Number.isFinite(Number(field.value))
  })
}
