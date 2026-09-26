import { describe, expect, it } from 'vitest'
import { normalizeCampaign } from './normalize'
import { canManageCampaign, canRunSession, handOver, removeMaster, removePlayer, sessionPlayers, transferOwnership } from './team'

const NOW = '2026-09-26T10:00:00.000Z'

function oldCampaign() {
  return normalizeCampaign({
    id: 'c', name: 'Старая', notes: [], masters: 'Сова + Лис',
    sessionRecords: [
      { id: 's1', title: 'Первая', master: 'Лис', group: 'Основная партия', planItems: [] },
      { id: 's2', title: 'Вторая', master: 'Незнакомец', group: 'основная партия', planItems: [] },
    ],
    secrets: [{ id: 'x', title: 'Т', truth: 'П', recipients: 'Ира', status: 'partial' }],
  }, NOW)!
}

describe('team migration', () => {
  it('turns the masters string into an owner and co-masters and resolves session names', () => {
    const campaign = oldCampaign()
    expect(campaign.masters.map((master) => [master.name, master.role])).toEqual([['Сова', 'owner'], ['Лис', 'co-master']])
    const [owl, fox] = campaign.masters
    expect(campaign.sessionRecords.map((session) => session.masterId)).toEqual([fox.id, owl.id])
    expect(campaign.groups.map((group) => group.name)).toEqual(['Основная партия'])
    expect(campaign.sessionRecords.map((session) => session.groupId)).toEqual([campaign.groups[0].id, campaign.groups[0].id])
    expect(campaign.secrets[0]).toMatchObject({ recipients: 'Ира', recipientIds: [] })
    expect(campaign).toMatchObject({ players: [], archived: false })
  })
})

describe('permissions', () => {
  it('lets only the owner manage the campaign and the responsible master or owner run a session', () => {
    const campaign = oldCampaign()
    const [owl, fox] = campaign.masters
    const [s1, s2] = campaign.sessionRecords
    expect(canManageCampaign(campaign, owl.id)).toBe(true)
    expect(canManageCampaign(campaign, fox.id)).toBe(false)
    expect(canRunSession(campaign, s1, fox.id)).toBe(true)
    expect(canRunSession(campaign, s2, fox.id)).toBe(false)
    expect(canRunSession(campaign, s2, owl.id)).toBe(true)
  })

  it('records handovers and moves sessions of a removed master to the owner', () => {
    const campaign = oldCampaign()
    const [owl, fox] = campaign.masters
    const handed = handOver(campaign.sessionRecords[1], fox.id, owl.id, NOW)
    expect(handed.masterId).toBe(fox.id)
    expect(handed.handovers).toEqual([expect.objectContaining({ fromId: owl.id, toId: fox.id, byId: owl.id, createdAt: NOW })])
    expect(handOver(handed, fox.id, owl.id, NOW)).toBe(handed)
    const removed = removeMaster(campaign, fox.id)
    expect(removed.masters).toHaveLength(1)
    expect(removed.sessionRecords[0].masterId).toBe(owl.id)
    expect(removeMaster(campaign, owl.id)).toBe(campaign)
  })

  it('transfers ownership, keeping the old owner as co-master', () => {
    const campaign = oldCampaign()
    const next = transferOwnership(campaign, campaign.masters[1].id)
    expect(next.masters.map((master) => master.role)).toEqual(['co-master', 'owner'])
  })
})

describe('players', () => {
  it('lists group players plus guests and cleans up when a player is removed', () => {
    const base = oldCampaign()
    const group = base.groups[0]
    const campaign = {
      ...base,
      players: [{ id: 'p1', name: 'Ира', characterIds: [], note: '' }, { id: 'p2', name: 'Тим', characterIds: [], note: '' }, { id: 'p3', name: 'Лена', characterIds: [], note: '' }],
      groups: [{ ...group, playerIds: ['p1', 'p2'] }],
      sessionRecords: base.sessionRecords.map((session, index) => index === 0 ? { ...session, guestPlayerIds: ['p3'] } : session),
      secrets: base.secrets.map((secret) => ({ ...secret, recipientIds: ['p3', group.id] })),
    }
    expect(sessionPlayers(campaign, campaign.sessionRecords[0]).map((player) => player.name)).toEqual(['Ира', 'Тим', 'Лена'])
    const next = removePlayer(campaign, 'p3')
    expect(next.sessionRecords[0].guestPlayerIds).toEqual([])
    expect(next.secrets[0].recipientIds).toEqual([group.id])
  })
})
