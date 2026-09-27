// What a delete takes with it (ТЗ-3, этап 5). A delete with consequences asks
// first and lists them; an empty list means a plain delete with «Отменить».

import { entityUsages } from './domain'
import { DEFAULT_RULES, WRITABLE_ROLES, rulesFor, type WritableRole } from './integration'
import { plural } from './labels'
import type { LocalCampaignEntityType, LocalCampaignRecord, LocalSessionRecord } from './types'

const quote = (name: string) => `«${name}»`

/** «А», «Б», «В» и ещё 2 — a short list of names for one consequence line. */
export function namesList(names: string[], limit = 3): string {
  const shown = names.slice(0, limit).map(quote).join(', ')
  return names.length > limit ? `${shown} и ещё ${names.length - limit}` : shown
}

const sessionName = (session: LocalSessionRecord) => `№${session.number} «${session.title}»`
const sessionsList = (sessions: LocalSessionRecord[], limit = 3) => {
  const shown = sessions.slice(0, limit).map(sessionName).join(', ')
  return sessions.length > limit ? `${shown} и ещё ${sessions.length - limit}` : shown
}

/** What deleting an entity unlinks: relations, clocks, secrets, players' characters, trashed plans, queued sends. */
export function entityRemovalImpact(campaign: LocalCampaignRecord, entityId: string): string[] {
  const entity = campaign.entities.find((item) => item.id === entityId)
  if (!entity) return []
  const usages = entityUsages(campaign, entityId)
  const nameOf = (id: string) => campaign.entities.find((item) => item.id === id)?.name ?? 'удалённая сущность'
  const lines: string[] = []
  if (usages.relations.length) {
    const others = usages.relations.map((relation) => nameOf(relation.fromId === entityId ? relation.toId : relation.fromId))
    lines.push(`${plural(usages.relations.length, 'Связь', 'Связи', 'Связи')} с ${namesList(others)} — ${plural(usages.relations.length, 'удалится', 'удалятся', 'удалятся')}`)
  }
  if (usages.clocks.length) lines.push(`Часы ${namesList(usages.clocks.map((clock) => clock.title))} — отвяжутся от неё`)
  if (usages.secrets.length) lines.push(`${plural(usages.secrets.length, 'Секрет', 'Секреты', 'Секреты')} ${namesList(usages.secrets.map((secret) => secret.title))} — отвяжутся от неё`)
  const players = campaign.players.filter((player) => player.characterIds.includes(entityId))
  if (players.length) lines.push(`${players.length === 1 ? 'Игрок' : 'Игроки'} ${namesList(players.map((player) => player.name))} — больше не ${players.length === 1 ? 'играет' : 'играют'} за неё`)
  const trashed = usages.plans.filter((usage) => usage.trashed).length
  if (trashed) lines.push(`${trashed} ${plural(trashed, 'пункт', 'пункта', 'пунктов')} в удалённых сессиях — ${plural(trashed, 'станет', 'станут', 'станут')} текстом с её именем`)
  const queued = campaign.publications.filter((item) => item.entityId === entityId && item.state !== 'succeeded').length
  if (queued) lines.push(`${queued} ${plural(queued, 'неотправленная операция', 'неотправленные операции', 'неотправленных операций')} в «Публикации» — ${plural(queued, 'уберётся', 'уберутся', 'уберутся')} из очереди`)
  return lines
}

/** What removing a plan item changes: a scene's members move out of it, transitions through the item go. */
export function planItemRemovalImpact(session: LocalSessionRecord, itemId: string, titleOf: (id: string) => string): string[] {
  const lines: string[] = []
  const members = session.planItems.filter((item) => item.sceneId === itemId)
  if (members.length) lines.push(`${members.length} ${plural(members.length, 'пункт', 'пункта', 'пунктов')} сцены (${namesList(members.map((item) => titleOf(item.id)))}) — ${plural(members.length, 'останется', 'останутся', 'останутся')} в плане «вне сцен»`)
  const flows = session.flows.filter((flow) => flow.fromItemId === itemId || flow.toItemId === itemId)
  if (flows.length) {
    const shown = flows.slice(0, 3).map((flow) => `${quote(titleOf(flow.fromItemId))} → ${quote(titleOf(flow.toItemId))}`).join(', ')
    lines.push(`${plural(flows.length, 'Переход', 'Переходы', 'Переходы')} ${shown}${flows.length > 3 ? ` и ещё ${flows.length - 3}` : ''} — ${plural(flows.length, 'удалится', 'удалятся', 'удалятся')}`)
  }
  return lines
}

/** Deletes a story arc and clears it from sessions (main and background) and clocks. */
export function removeArc(campaign: LocalCampaignRecord, arcId: string): LocalCampaignRecord {
  return {
    ...campaign,
    storyArcs: campaign.storyArcs.filter((arc) => arc.id !== arcId),
    sessionRecords: campaign.sessionRecords.map((session) => session.arcId !== arcId && !session.backgroundArcIds.includes(arcId) ? session : {
      ...session,
      arcId: session.arcId === arcId ? '' : session.arcId,
      backgroundArcIds: session.backgroundArcIds.filter((id) => id !== arcId),
    }),
    clocks: campaign.clocks.map((clock) => clock.arcId === arcId ? { ...clock, arcId: '' } : clock),
  }
}

/** What deleting an arc unlinks. Trashed sessions are not counted: nobody sees them. */
export function arcRemovalImpact(campaign: LocalCampaignRecord, arcId: string): string[] {
  const sessions = campaign.sessionRecords.filter((session) => !session.deletedAt)
  const main = sessions.filter((session) => session.arcId === arcId)
  const background = sessions.filter((session) => session.backgroundArcIds.includes(arcId))
  const clocks = campaign.clocks.filter((clock) => clock.arcId === arcId)
  const lines: string[] = []
  if (main.length) lines.push(`${main.length === 1 ? 'Сессия' : 'Сессии'} ${sessionsList(main)} — ${main.length === 1 ? 'останется' : 'останутся'} без основной линии`)
  if (background.length) lines.push(`${background.length === 1 ? 'Сессия' : 'Сессии'} ${sessionsList(background)} — линия уйдёт из фоновых`)
  if (clocks.length) lines.push(`Часы ${namesList(clocks.map((clock) => clock.title))} — отвяжутся от линии`)
  return lines
}

/** What deleting a group changes: sessions played for it lose the group, secrets told to it lose it as a recipient. */
export function groupRemovalImpact(campaign: LocalCampaignRecord, groupId: string): string[] {
  const sessions = campaign.sessionRecords.filter((session) => !session.deletedAt && session.groupId === groupId)
  const secrets = campaign.secrets.filter((secret) => secret.recipientIds.includes(groupId))
  const lines: string[] = []
  if (sessions.length) lines.push(`${sessions.length === 1 ? 'Сессия' : 'Сессии'} ${sessionsList(sessions)} — ${sessions.length === 1 ? 'останется' : 'останутся'} без группы`)
  if (secrets.length) lines.push(`${plural(secrets.length, 'Секрет', 'Секреты', 'Секреты')} ${namesList(secrets.map((secret) => secret.title))} — группа уйдёт из получателей`)
  return lines
}

/** Types whose sending rule «По умолчанию» changes back, with the current and the default roles. */
export function rulesResetChanges(campaign: Pick<LocalCampaignRecord, 'publishRules'>): Array<{ type: LocalCampaignEntityType; from: WritableRole[]; to: WritableRole[] }> {
  const same = (a: WritableRole[], b: WritableRole[]) => WRITABLE_ROLES.every((role) => a.includes(role) === b.includes(role))
  return (Object.keys(campaign.publishRules ?? {}) as LocalCampaignEntityType[])
    .map((type) => ({ type, from: rulesFor(campaign, type), to: DEFAULT_RULES[type] }))
    .filter((change) => !same(change.from, change.to))
}
