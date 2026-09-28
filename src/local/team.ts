import type { LocalCampaignRecord, LocalGroup, LocalMaster, LocalPlayer, LocalSessionRecord } from './types'

export const newMaster = (name: string, role: LocalMaster['role'] = 'co-master'): LocalMaster => ({ id: `master-${crypto.randomUUID()}`, name: name.trim(), role })
export const newPlayer = (name: string): LocalPlayer => ({ id: `player-${crypto.randomUUID()}`, name: name.trim(), characterIds: [], note: '' })
export const newGroup = (name: string, playerIds: string[] = []): LocalGroup => ({ id: `group-${crypto.randomUUID()}`, name: name.trim(), playerIds })

/** A new master's name from their sign-in address: the part before «@». */
export const nameFromEmail = (email: string): string => email.split('@')[0].trim() || 'Мастер'

/** Old campaigns stored masters as "Сова + Лис"; the first name becomes the owner. */
export function parseMasters(text: string): LocalMaster[] {
  const names = text.split(/[+,]/).map((name) => name.trim()).filter(Boolean)
  return (names.length ? names : ['Мастер']).map((name, index) => newMaster(name, index === 0 ? 'owner' : 'co-master'))
}

export const ownerOf = (campaign: LocalCampaignRecord): LocalMaster => campaign.masters.find((master) => master.role === 'owner') ?? campaign.masters[0]
export const masterName = (campaign: LocalCampaignRecord, id: string): string => campaign.masters.find((master) => master.id === id)?.name ?? 'Не назначен'
export const mastersLabel = (campaign: LocalCampaignRecord): string => campaign.masters.map((master) => master.name).join(' + ')

// ─── Permissions (decision D2: labels plus restrictions) ────────────────────

export const isOwner = (campaign: LocalCampaignRecord, masterId: string) => campaign.masters.some((master) => master.id === masterId && master.role === 'owner')

/** Masters, ownership, archive and deletion belong to the owner. */
export const canManageCampaign = isOwner

/** Starting, closing and reviewing a session: its responsible master or the owner. */
export const canRunSession = (campaign: LocalCampaignRecord, session: LocalSessionRecord, masterId: string) => session.masterId === masterId || isOwner(campaign, masterId)

export function runSessionHint(campaign: LocalCampaignRecord, session: LocalSessionRecord): string {
  return `Доступно ответственному мастеру (${masterName(campaign, session.masterId)}) и владельцу кампании`
}

/** Hands a session to another master and records who did it. */
export function handOver(session: LocalSessionRecord, toId: string, byId: string, now: string): LocalSessionRecord {
  if (session.masterId === toId) return session
  return { ...session, masterId: toId, handovers: [...session.handovers, { id: `handover-${crypto.randomUUID()}`, fromId: session.masterId, toId, byId, createdAt: now }] }
}

/** Makes another master the owner; the previous owner stays as co-master. */
export function transferOwnership(campaign: LocalCampaignRecord, toId: string): LocalCampaignRecord {
  if (!campaign.masters.some((master) => master.id === toId)) return campaign
  return { ...campaign, masters: campaign.masters.map((master) => ({ ...master, role: master.id === toId ? 'owner' : 'co-master' })) }
}

/** Removes a co-master; their sessions pass to the owner. The owner cannot be removed. */
export function removeMaster(campaign: LocalCampaignRecord, masterId: string): LocalCampaignRecord {
  if (isOwner(campaign, masterId)) return campaign
  const owner = ownerOf(campaign)
  return {
    ...campaign,
    masters: campaign.masters.filter((master) => master.id !== masterId),
    sessionRecords: campaign.sessionRecords.map((session) => session.masterId === masterId ? { ...session, masterId: owner.id } : session),
  }
}

// ─── Players and groups ─────────────────────────────────────────────────────

export function removePlayer(campaign: LocalCampaignRecord, playerId: string): LocalCampaignRecord {
  return {
    ...campaign,
    players: campaign.players.filter((player) => player.id !== playerId),
    groups: campaign.groups.map((group) => ({ ...group, playerIds: group.playerIds.filter((id) => id !== playerId) })),
    sessionRecords: campaign.sessionRecords.map((session) => ({ ...session, guestPlayerIds: session.guestPlayerIds.filter((id) => id !== playerId) })),
    secrets: campaign.secrets.map((secret) => ({ ...secret, recipientIds: secret.recipientIds.filter((id) => id !== playerId) })),
  }
}

export function removeGroup(campaign: LocalCampaignRecord, groupId: string): LocalCampaignRecord {
  return {
    ...campaign,
    groups: campaign.groups.filter((group) => group.id !== groupId),
    sessionRecords: campaign.sessionRecords.map((session) => session.groupId === groupId ? { ...session, groupId: '' } : session),
    secrets: campaign.secrets.map((secret) => ({ ...secret, recipientIds: secret.recipientIds.filter((id) => id !== groupId) })),
  }
}

/** Everyone at the table for a session: the group's players plus invited guests. */
export function sessionPlayers(campaign: LocalCampaignRecord, session: LocalSessionRecord): LocalPlayer[] {
  const group = campaign.groups.find((item) => item.id === session.groupId)
  const ids = new Set([...(group?.playerIds ?? []), ...session.guestPlayerIds])
  return campaign.players.filter((player) => ids.has(player.id))
}

/** Human-readable list of who knows something: named players/groups plus free text. */
export function recipientsLabel(campaign: LocalCampaignRecord, ids: string[], extra = ''): string {
  const names = ids.map((id) => campaign.groups.find((group) => group.id === id)?.name ?? campaign.players.find((player) => player.id === id)?.name).filter(Boolean)
  return [...names, extra.trim()].filter(Boolean).join(', ')
}

/** Characters (library entities) that belong to a player. */
export const playerCharacters = (campaign: LocalCampaignRecord, player: LocalPlayer) => campaign.entities.filter((entity) => player.characterIds.includes(entity.id))
