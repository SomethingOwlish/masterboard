import type { InboxTarget } from './inbox'
import type {
  LocalCampaignClock, LocalCampaignEntity, LocalCampaignEntityType, LocalCampaignRecord, LocalLogKind, LocalRelationType, LocalSecretStatus,
  LocalReviewDecision, LocalSessionPlanItem, LocalSessionPlanKind, LocalSessionRecord, LocalStoryArc, LocalWidgetId,
} from './types'

// One map per notion (ТЗ-3, этап 6): every status, visibility, kind and type
// label lives here, so a word is changed in one place.

export const WIDGETS = ['session', 'arcs', 'clocks', 'secrets', 'tasks', 'inbox'] as const satisfies readonly LocalWidgetId[]
export const WIDGET_LABEL: Record<LocalWidgetId, string> = { session: 'Текущая сессия', arcs: 'Активные линии', clocks: 'Часы', secrets: 'Секреты', tasks: 'Задачи', inbox: 'Входящие' }

export const ARC_STATUS: Record<LocalStoryArc['status'], string> = { planned: 'Замысел', active: 'В игре', paused: 'Приостановлена', resolved: 'Завершена', cancelled: 'Отменена' }
export const SECRET_STATUS: Record<LocalSecretStatus, string> = { hidden: 'Не раскрыт', partial: 'Частично', selected: 'Выбранным героям', everyone: 'Всем героям', disproved: 'Опровергнут', obsolete: 'Устарел' }

export type Visibility = 'master' | 'public'
export const VISIBILITY_LABEL: Record<Visibility, string> = { master: 'Только мастерам', public: 'Для игроков' }

export const ENTITY_TYPES: Array<{ value: LocalCampaignEntityType; label: string }> = [
  ['character', 'Персонаж'], ['npc', 'NPC'], ['creature', 'Существо'], ['location', 'Локация'], ['faction', 'Фракция'], ['rumor', 'Слух'],
  ['item', 'Предмет'], ['audience', 'Аудитория'], ['note', 'Заметка'], ['letter', 'Письмо'], ['handout', 'Раздаточный материал'], ['map', 'Карта'],
  ['event', 'Событие'], ['lore', 'Лор / статья'], ['home-rule', 'Домашнее правило'],
].map(([value, label]) => ({ value: value as LocalCampaignEntityType, label }))
export const ENTITY_LABEL = Object.fromEntries(ENTITY_TYPES.map((item) => [item.value, item.label])) as Record<LocalCampaignEntityType, string>
export const ENTITY_STATUS_LABEL: Record<LocalCampaignEntity['status'], string> = { active: 'Активна', inactive: 'Неактивна', archived: 'В архиве' }
export const ORIGIN_LABEL: Record<LocalCampaignEntity['origin']['kind'], string> = {
  manual: 'Создано вручную', plan: 'Из плана сессии', live: 'Из живой сессии', inbox: 'Из входящих', import: 'Импорт', improv: 'Из заготовок',
}

export const RELATION_TYPE: Record<LocalRelationType, string> = { alliance: 'Союз', enmity: 'Вражда', debt: 'Долг', kin: 'Родство', belongs: 'Принадлежность', other: 'Другое' }
export const CLOCK_KIND: Record<LocalCampaignClock['kind'], string> = { threat: 'Угроза', goal: 'Цель', project: 'Проект', world: 'Состояние мира' }
export const LOG_KIND: Record<LocalLogKind, string> = { moment: 'Момент', decision: 'Решение', reveal: 'Раскрытие', roll: 'Бросок', clock: 'Часы', entity: 'Новое в мире' }

/** Interface themes (the design system's ThemeSwitcher is in English by default). */
export const THEME_LABELS = {
  families: { parchment: 'Пергамент', sage: 'Шалфей', sumi: 'Суми', indigo: 'Индиго', dusk: 'Сумерки' },
  light: 'Светлая тема',
  dark: 'Тёмная тема',
}

/** Inbox actions, the same on the Overview and in the Control panel. */
export const INBOX_CAPTURE = 'Записать'
export const INBOX_ACTIONS: Array<[InboxTarget, string]> = [['task', 'В задачу'], ['entity', 'В библиотеку'], ['clock', 'В часы'], ['secret', 'В секрет'], ['note', 'В заметку']]

export const PRIORITIES = [['required', 'Обязательно'], ['desired', 'Желательно'], ['useful', 'Полезно'], ['backup', 'Запас']] as const
export const PLAN_KINDS: Array<[LocalSessionPlanKind, string]> = [
  ['scene', 'Сцена'], ['idea', 'Идея'], ['goal', 'Цель'], ['event', 'Событие'], ['question', 'Вопрос'], ['secret', 'Секрет'], ['npc', 'NPC'],
  ['material', 'Материал'], ['note', 'Заметка'], ['consequence', 'Последствие'],
]
export const USE_STATUS = [['prepared', 'Подготовлено'], ['current', 'Актуально'], ['used', 'Использовано'], ['skipped', 'Пропущено'], ['moved', 'Перенесено'], ['cancelled', 'Отменено']] as const
export const PRIORITY_LABEL = Object.fromEntries(PRIORITIES) as Record<LocalSessionPlanItem['priority'], string>
export const KIND_LABEL = Object.fromEntries(PLAN_KINDS) as Record<LocalSessionPlanKind, string>
export const USE_STATUS_LABEL = Object.fromEntries(USE_STATUS) as Record<LocalSessionPlanItem['status'], string>

export const REVIEW_DECISION: Record<LocalReviewDecision, string> = { carry: 'Перенести в следующую', library: 'Вернуть только в библиотеку', cancel: 'Отменить', keep: 'Оставить неиспользованным' }

export const SESSION_STATUS: Record<LocalSessionRecord['status'], string> = { draft: 'Черновик', ready: 'Готова', active: 'Проводится', completed: 'Закрыта' }
/** Session status with what is left to do: a closed session is either waiting for its review or reviewed. */
export const sessionStatusText = (session: Pick<LocalSessionRecord, 'status' | 'reviewStatus'>): string =>
  session.status === 'completed' ? (session.reviewStatus === 'completed' ? 'Разобрана' : 'Закрыта · нужен разбор') : SESSION_STATUS[session.status]

/** Shown in the interface where a campaign has no idea or in-game time yet; never stored (ТЗ-3, этап 6). */
export const IDEA_PLACEHOLDER = 'Новая история ждёт первой сессии.'
export const TIME_PLACEHOLDER = 'Время ещё не задано'

export const withSession = (campaign: LocalCampaignRecord, session: LocalSessionRecord): LocalCampaignRecord =>
  ({ ...campaign, sessionRecords: campaign.sessionRecords.map((item) => item.id === session.id ? session : item) })

/** Russian noun form for a count: plural(1, 'операция', 'операции', 'операций') → «операция»; 2 → «операции»; 5, 11, 12 → «операций». */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = Math.abs(count) % 10
  const mod100 = Math.abs(count) % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}
