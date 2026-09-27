import type { LocalCampaignClock, LocalCampaignEntity, LocalCampaignRecord, LocalCampaignSecret, LocalSessionPlanItem, LocalSessionRecord } from './types'

/** What the director sheet shows for one session, filtered by its print config. */
export interface DirectorSheet {
  groups: Array<{ priority: LocalSessionPlanItem['priority']; items: LocalSessionPlanItem[] }>
  entities: LocalCampaignEntity[]
  secrets: LocalCampaignSecret[]
  clocks: LocalCampaignClock[]
}

/** Everything that may be handed to players: public records linked to the session. */
export interface PlayerHandouts {
  entities: LocalCampaignEntity[]
  /** Only the public wording: the secret's title is the master's name for it. */
  secrets: Array<{ id: string; text: string }>
  clocks: LocalCampaignClock[]
}

const linkedEntityIds = (session: LocalSessionRecord) => new Set(session.planItems.flatMap((item) => item.entityId ? [item.entityId] : []))
const linkedSecretIds = (session: LocalSessionRecord) => new Set(session.planItems.flatMap((item) => item.secretId ? [item.secretId] : []))

export function directorSheet(campaign: LocalCampaignRecord, session: LocalSessionRecord): DirectorSheet {
  const config = session.printConfig
  const entityIds = linkedEntityIds(session)
  const secretIds = linkedSecretIds(session)
  const arcIds = new Set([session.arcId, ...session.backgroundArcIds].filter(Boolean))
  const related = (clock: LocalCampaignClock) => arcIds.has(clock.arcId) || clock.entityIds.some((id) => entityIds.has(id)) || clock.secretIds.some((id) => secretIds.has(id))
  return {
    groups: config.priorities.map((priority) => ({ priority, items: session.planItems.filter((item) => item.priority === priority && item.status !== 'cancelled') })).filter((group) => group.items.length),
    entities: config.entities ? campaign.entities.filter((entity) => entityIds.has(entity.id)) : [],
    secrets: config.secrets ? campaign.secrets.filter((secret) => secretIds.has(secret.id) || secret.sessionIds.includes(session.id)) : [],
    // Every clock still in play; the ones tied to this session come first.
    clocks: config.clocks ? campaign.clocks.filter((clock) => clock.triggerStatus !== 'fired').sort((left, right) => Number(related(right)) - Number(related(left))) : [],
  }
}

export function playerHandouts(campaign: LocalCampaignRecord, session: LocalSessionRecord): PlayerHandouts {
  const entityIds = linkedEntityIds(session)
  const secretIds = linkedSecretIds(session)
  return {
    entities: campaign.entities.filter((entity) => entity.visibility === 'public' && entity.status !== 'archived' && entityIds.has(entity.id)),
    secrets: campaign.secrets
      // `selected` is known to some heroes only, so it stays off the shared sheet.
      .filter((secret) => (secretIds.has(secret.id) || secret.sessionIds.includes(session.id)) && secret.publicVersion.trim() && (secret.status === 'partial' || secret.status === 'everyone'))
      .map((secret) => ({ id: secret.id, text: secret.publicVersion })),
    clocks: campaign.clocks.filter((clock) => clock.visibility === 'public'),
  }
}
