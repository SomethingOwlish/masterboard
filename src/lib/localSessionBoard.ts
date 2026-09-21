import type { LocalSessionScene } from '../fixtures/localCampaignCatalog'

export interface ScenePoint { x: number; y: number }
export const TOKEN_SIZE = { width: 180, height: 44 }
export function scenePosition(scene: LocalSessionScene, index: number): ScenePoint {
  return scene.position ?? { x: (index % 3) * 440, y: Math.floor(index / 3) * 360 }
}
export function sceneSize(scene: LocalSessionScene) {
  return scene.size ?? { width: 360, height: Math.max(260, 90 + (scene.memberIds?.length ?? 0) * 56) }
}
export function tokenPosition(scene: LocalSessionScene, entityId: string): ScenePoint {
  return scene.tokenPositions?.[entityId] ?? { x: 20, y: 70 + Math.max(0, scene.memberIds?.indexOf(entityId) ?? 0) * 56 }
}

export function fitSceneToMembers(scene: LocalSessionScene): LocalSessionScene {
  const size = sceneSize(scene)
  const points = (scene.memberIds ?? []).map((id) => tokenPosition(scene, id))
  return { ...scene, size: { width: Math.max(size.width, ...points.map((point) => point.x + TOKEN_SIZE.width + 20)), height: Math.max(size.height, ...points.map((point) => point.y + TOKEN_SIZE.height + 20)) } }
}

export function addSceneMember(scenes: LocalSessionScene[], sceneId: string, entityId: string, position?: ScenePoint): LocalSessionScene[] {
  return scenes.map((scene) => {
    if (scene.id !== sceneId) return scene
    const members = [...new Set([...(scene.memberIds ?? []), entityId])]
    const point = position ?? tokenPosition({ ...scene, memberIds: members }, entityId)
    const size = sceneSize(scene)
    return { ...scene, memberIds: members, tokenPositions: { ...scene.tokenPositions, [entityId]: { x: Math.max(12, point.x), y: Math.max(64, point.y) } }, size: { width: Math.max(size.width, point.x + TOKEN_SIZE.width + 20), height: Math.max(size.height, point.y + TOKEN_SIZE.height + 20) } }
  })
}

export function removeSceneMember(scenes: LocalSessionScene[], sceneId: string, entityId: string): LocalSessionScene[] {
  return scenes.map((scene) => {
    if (scene.id !== sceneId) return scene
    const positions = { ...scene.tokenPositions }
    delete positions[entityId]
    return { ...scene, memberIds: scene.memberIds?.filter((id) => id !== entityId), tokenPositions: positions }
  })
}

/** Moves one placement; the library entity and its placements in other scenes stay intact. */
export function moveSceneMember(scenes: LocalSessionScene[], sourceId: string, targetId: string, entityId: string, point: ScenePoint): LocalSessionScene[] {
  if (!scenes.some((scene) => scene.id === targetId)) return scenes
  return addSceneMember(sourceId === targetId ? scenes : removeSceneMember(scenes, sourceId, entityId), targetId, entityId, point)
}

export function removeBoardScene(scenes: LocalSessionScene[], sceneId: string): LocalSessionScene[] {
  return scenes.filter((scene) => scene.id !== sceneId).map((scene) => ({ ...scene, nextSceneIds: scene.nextSceneIds?.filter((id) => id !== sceneId) }))
}

export function validSceneLayout(scene: LocalSessionScene): boolean {
  const point = (value: unknown) => !!value && typeof value === 'object' && Number.isFinite((value as ScenePoint).x) && Number.isFinite((value as ScenePoint).y)
  return (scene.position === undefined || point(scene.position)) &&
    (scene.size === undefined || !!scene.size && Number.isFinite(scene.size.width) && Number.isFinite(scene.size.height) && scene.size.width >= 240 && scene.size.height >= 160) &&
    (scene.tokenPositions === undefined || !!scene.tokenPositions && typeof scene.tokenPositions === 'object' && !Array.isArray(scene.tokenPositions) && Object.values(scene.tokenPositions).every(point)) &&
    (scene.nextSceneIds === undefined || Array.isArray(scene.nextSceneIds) && scene.nextSceneIds.every((id) => typeof id === 'string'))
}
