import { describe, expect, it } from 'vitest'
import { blankSession, normalizeCampaign, withLocalSessions } from './normalize'
import { applyImprov, defaultLayout, moveWidget, newImprov, toggleHidden, withLayout } from './personal'

const NOW = '2026-09-26T10:00:00.000Z'
const base = () => normalizeCampaign({ id: 'c', name: 'К', notes: [], masters: 'Сова + Лис' }, NOW)!

describe('overview layout', () => {
  it('moves widgets among visible ones and keeps layouts per master', () => {
    const hidden = toggleHidden(defaultLayout(), 'arcs')
    expect(moveWidget(hidden, 'clocks', -1).order.slice(0, 3)).toEqual(['clocks', 'arcs', 'session'])
    expect(moveWidget(defaultLayout(), 'session', -1)).toEqual(defaultLayout())
    const campaign = base()
    const [owl, fox] = campaign.masters
    const next = withLayout(campaign, owl.id, hidden)
    expect(next.dashboardLayouts[owl.id].hidden).toEqual(['arcs'])
    expect(next.dashboardLayouts[fox.id]).toBeUndefined()
    expect(withLayout(next, owl.id, null).dashboardLayouts).toEqual({})
  })

  it('fills in widgets missing from a stored layout', () => {
    const campaign = normalizeCampaign({ id: 'c', name: 'К', notes: [], dashboardLayouts: { m: { order: ['inbox', 'bogus'], hidden: ['tasks'] } } }, NOW)!
    expect(campaign.dashboardLayouts.m).toEqual({ order: ['inbox', 'session', 'arcs', 'clocks', 'secrets', 'tasks'], hidden: ['tasks'], wide: [] })
  })
})

describe('improv', () => {
  it('turns a used NPC into a library entry, logs it and marks it played in the session', () => {
    const campaign = base()
    const owl = campaign.masters[0]
    const session = { ...blankSession(1, owl.id, NOW, 's1'), title: 'Первая', status: 'active' as const }
    const item = newImprov(owl.id, 'npc', 'Мирта Солеварка')
    const next = applyImprov(withLocalSessions({ ...campaign, improv: [item] }, [session]), item.id, NOW, session)
    expect(next.entities[0]).toMatchObject({ type: 'npc', name: 'Мирта Солеварка', origin: { kind: 'improv', sessionId: 's1' } })
    expect(next.improv[0]).toMatchObject({ usedAt: NOW, usedSessionId: 's1', entityId: next.entities[0].id })
    expect(next.sessionRecords[0].log[0]).toMatchObject({ kind: 'entity', text: 'Импровизация (npc): Мирта Солеварка' })
    expect(next.sessionRecords[0].planItems[0]).toMatchObject({ entityId: next.entities[0].id, status: 'used', origin: 'live' })
    expect(applyImprov(next, item.id, NOW, session)).toBe(next)
  })

  it('only marks names and complications as used outside a session', () => {
    const campaign = base()
    const item = newImprov(campaign.masters[0].id, 'complication', 'Фонари гаснут')
    const next = applyImprov({ ...campaign, improv: [item] }, item.id, NOW)
    expect(next.entities).toEqual([])
    expect(next.improv[0].usedAt).toBe(NOW)
  })
})
