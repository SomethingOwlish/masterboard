import type { LocalCampaignRecord, LocalSecretStatus, LocalSessionRecord, LocalStoryArc, LocalWidgetId } from './types'

export const WIDGETS = ['session', 'arcs', 'clocks', 'secrets', 'tasks', 'inbox'] as const satisfies readonly LocalWidgetId[]
export const WIDGET_LABEL: Record<LocalWidgetId, string> = { session: 'Текущая сессия', arcs: 'Активные линии', clocks: 'Часы', secrets: 'Секреты', tasks: 'Список ведущего', inbox: 'Входящие' }

export const ARC_STATUS: Record<LocalStoryArc['status'], string> = { planned: 'Замысел', active: 'В игре', paused: 'Приостановлена', resolved: 'Завершена', cancelled: 'Отменена' }
export const SECRET_STATUS: Record<LocalSecretStatus, string> = { hidden: 'Не раскрыт', partial: 'Частично', selected: 'Выбранным героям', everyone: 'Всем героям', disproved: 'Опровергнут', obsolete: 'Устарел' }

export const SESSION_STATUS: Record<LocalSessionRecord['status'], string> = { draft: 'Черновик', ready: 'Готова', active: 'Проводится', completed: 'Закрыта' }
/** Session status with what is left to do: a closed session is either waiting for its review or reviewed. */
export const sessionStatusText = (session: Pick<LocalSessionRecord, 'status' | 'reviewStatus'>): string =>
  session.status === 'completed' ? (session.reviewStatus === 'completed' ? 'Разобрана' : 'Закрыта · нужен разбор') : SESSION_STATUS[session.status]

export const withSession = (campaign: LocalCampaignRecord, session: LocalSessionRecord): LocalCampaignRecord =>
  ({ ...campaign, sessionRecords: campaign.sessionRecords.map((item) => item.id === session.id ? session : item) })
