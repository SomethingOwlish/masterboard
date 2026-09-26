import type { LocalCampaignRecord, LocalSecretStatus, LocalSessionRecord, LocalStoryArc, LocalWidgetId } from './types'

export const WIDGETS = ['session', 'arcs', 'clocks', 'secrets', 'tasks', 'inbox'] as const satisfies readonly LocalWidgetId[]
export const WIDGET_LABEL: Record<LocalWidgetId, string> = { session: 'Текущая сессия', arcs: 'Активные линии', clocks: 'Часы', secrets: 'Секреты', tasks: 'Список ведущего', inbox: 'Входящие' }

export const ARC_STATUS: Record<LocalStoryArc['status'], string> = { planned: 'Замысел', active: 'В игре', paused: 'Приостановлена', resolved: 'Завершена', cancelled: 'Отменена' }
export const SECRET_STATUS: Record<LocalSecretStatus, string> = { hidden: 'Не раскрыт', partial: 'Частично', selected: 'Выбранным героям', everyone: 'Всем героям', disproved: 'Опровергнут', obsolete: 'Устарел' }

export const withSession = (campaign: LocalCampaignRecord, session: LocalSessionRecord): LocalCampaignRecord =>
  ({ ...campaign, sessionRecords: campaign.sessionRecords.map((item) => item.id === session.id ? session : item) })
