import type { LocalCampaignRecord, LocalSecretStatus, LocalSessionRecord, LocalStoryArc } from './types'

export const ARC_STATUS: Record<LocalStoryArc['status'], string> = { planned: 'Замысел', active: 'В игре', paused: 'Приостановлена', resolved: 'Завершена', cancelled: 'Отменена' }
export const SECRET_STATUS: Record<LocalSecretStatus, string> = { hidden: 'Не раскрыт', partial: 'Частично', selected: 'Выбранным героям', everyone: 'Всем героям', disproved: 'Опровергнут', obsolete: 'Устарел' }

export const withSession = (campaign: LocalCampaignRecord, session: LocalSessionRecord): LocalCampaignRecord =>
  ({ ...campaign, sessionRecords: campaign.sessionRecords.map((item) => item.id === session.id ? session : item) })
