import type { LocalSessionPlanItem, LocalSessionPlanKind, LocalSessionRecord } from '../../../local/types'
import type { MoveTarget } from '../../../local/plan'

export const PRIORITIES = [['required', 'Обязательно'], ['desired', 'Желательно'], ['useful', 'Полезно'], ['backup', 'Запас']] as const
export const PLAN_KINDS: Array<[LocalSessionPlanKind, string]> = [['scene', 'Сцена'], ['idea', 'Идея'], ['goal', 'Цель'], ['event', 'Событие'], ['question', 'Вопрос'], ['secret', 'Секрет'], ['npc', 'NPC'], ['material', 'Материал'], ['note', 'Заметка'], ['consequence', 'Последствие']]
export const USE_STATUS = [['prepared', 'Подготовлено'], ['current', 'Актуально'], ['used', 'Использовано'], ['skipped', 'Пропущено'], ['moved', 'Перенесено'], ['cancelled', 'Отменено']] as const

/** Operations the plan views share; the sessions workspace provides them. */
export interface PlanApi {
  session: LocalSessionRecord
  itemTitle: (item: LocalSessionPlanItem) => string
  update: (session: LocalSessionRecord) => void
  patchItem: (id: string, patch: Partial<LocalSessionPlanItem>) => void
  setStatus: (id: string, status: LocalSessionPlanItem['status']) => void
  move: (id: string, target: MoveTarget) => void
  shift: (id: string, delta: number) => void
  remove: (id: string) => void
  saveToLibrary: (item: LocalSessionPlanItem) => void
}
