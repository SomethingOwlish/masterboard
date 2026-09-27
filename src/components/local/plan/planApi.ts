import type { LocalCampaignRecord, LocalSessionPlanItem, LocalSessionPlanKind, LocalSessionRecord } from '../../../local/types'
import type { MoveTarget } from '../../../local/plan'

export const PRIORITIES = [['required', 'Обязательно'], ['desired', 'Желательно'], ['useful', 'Полезно'], ['backup', 'Запас']] as const
export const PLAN_KINDS: Array<[LocalSessionPlanKind, string]> = [['scene', 'Сцена'], ['idea', 'Идея'], ['goal', 'Цель'], ['event', 'Событие'], ['question', 'Вопрос'], ['secret', 'Секрет'], ['npc', 'NPC'], ['material', 'Материал'], ['note', 'Заметка'], ['consequence', 'Последствие']]
export const USE_STATUS = [['prepared', 'Подготовлено'], ['current', 'Актуально'], ['used', 'Использовано'], ['skipped', 'Пропущено'], ['moved', 'Перенесено'], ['cancelled', 'Отменено']] as const
export const PRIORITY_LABEL = Object.fromEntries(PRIORITIES) as Record<LocalSessionPlanItem['priority'], string>
export const KIND_LABEL = Object.fromEntries(PLAN_KINDS) as Record<LocalSessionPlanKind, string>

/** A library record or campaign secret to put into the plan. */
export type LinkedSource = { type: 'entity' | 'secret'; id: string }
/** Where a new item goes: into a scene (its id) or outside every scene (`null`). */
export type PlanTarget = string | null

/** Drag-and-drop payloads inside the plan. */
export const DRAG_ITEM = 'text/plan-item'
export const DRAG_SOURCE = 'text/plan-source'

/** Operations the plan views share; the sessions workspace provides them. */
export interface PlanApi {
  campaign: LocalCampaignRecord
  session: LocalSessionRecord
  itemTitle: (item: LocalSessionPlanItem) => string
  update: (session: LocalSessionRecord) => void
  patchItem: (id: string, patch: Partial<LocalSessionPlanItem>) => void
  setStatus: (id: string, status: LocalSessionPlanItem['status']) => void
  move: (id: string, target: MoveTarget) => void
  shift: (id: string, delta: number) => void
  /** Up / down among peers: scenes among scenes, items within their scene. */
  shiftAmongPeers: (id: string, delta: -1 | 1) => void
  remove: (id: string) => void
  saveToLibrary: (item: LocalSessionPlanItem) => void
  addText: (text: string, kind: LocalSessionPlanKind, priority: LocalSessionPlanItem['priority'], target: PlanTarget) => void
  addLinked: (sources: LinkedSource[], target: PlanTarget, priority: LocalSessionPlanItem['priority']) => void
  /** Opens the library picker aimed at a scene (or outside scenes). */
  openPicker: (target: PlanTarget) => void
  /** Opens the library editor for a record used in the plan. */
  editEntity: (entityId: string) => void
  /** Opens the editor of a plan item or scene: title, type, priority, notes, links. */
  editItem: (itemId: string) => void
}
