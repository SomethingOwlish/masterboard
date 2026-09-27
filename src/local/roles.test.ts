import { describe, expect, it } from 'vitest'
import { newEntity } from './domain'
import { baseIntegrations, baseName, entityRoles, linkedRole, roleConnection, withLink } from './integration'
import { normalizeCampaign } from './normalize'
import { enqueueByRoles, pendingByRoles } from './publishing'

const NOW = '2026-09-27T12:00:00.000Z'
const campaign = (patch: Record<string, unknown> = {}) => normalizeCampaign({ id: 'c', name: 'К', ...patch }, NOW)!
const world = { externalId: 'w-port', label: 'Лунный порт' }
const kk9 = { externalId: 'k-1', label: 'Стол КК9' }

describe('roles of external systems (ТЗ-2, R3)', () => {
  it('keeps one table: linking КК9 unlinks ЛавГеймс', () => {
    const withLove = withLink(campaign(), 'lovegame', { externalId: 'c-lanterns', label: 'Фонари' })
    const withKk9 = withLink(withLove, 'kk9', kk9)
    expect(withKk9.integrations).toEqual({ kk9 })
    expect(linkedRole(withKk9, 'table')?.system).toBe('kk9')
    expect(withLink(withKk9, 'kk9', null).integrations).toEqual({})
  })

  it('sends lore to the world and characters to the table by default, only where linked', () => {
    const linked = withLink(withLink(campaign(), 'lorebook', world), 'kk9', kk9)
    expect(entityRoles(linked, { type: 'location' })).toEqual(['world'])
    expect(entityRoles(linked, { type: 'npc' })).toEqual(['table'])
    expect(entityRoles(linked, { type: 'note' })).toEqual([])
    expect(entityRoles(withLink(campaign(), 'lorebook', world), { type: 'npc' })).toEqual([])
    expect(entityRoles(linked, { type: 'npc', destinations: ['world', 'table'] })).toEqual(['world', 'table'])
    expect(entityRoles({ ...linked, publishRules: { npc: ['world'] } }, { type: 'npc' })).toEqual(['world'])
  })

  it('reads a SystemSetup system through its pack connection', () => {
    expect(roleConnection('systemsetup', { externalId: 'kk9-rules', label: 'КК9', connectionId: 'packs' })).toBe('systemsetup:packs')
    expect(roleConnection('lorebook', world)).toBe('lorebook:w-port')
  })

  it('turns the base chosen at creation into links and a name', () => {
    const choice = { world: { system: 'lorebook' as const, externalId: 'w-port', label: 'Лунный порт' }, system: { system: 'systemsetup' as const, externalId: 'kk9-rules', label: 'Правила', connectionId: 'packs' } }
    expect(baseIntegrations(choice)).toEqual({ lorebook: { externalId: 'w-port', label: 'Лунный порт' }, systemsetup: { externalId: 'kk9-rules', label: 'Правила', connectionId: 'packs' } })
    expect(baseName(choice)).toBe('Лунный порт')
    expect(baseName({})).toBe('')
  })
})

describe('queue by roles', () => {
  it('queues an entity for each place once, and skips a place that takes no such type', () => {
    const base = withLink(withLink(campaign({ entities: [newEntity({ id: 'n', type: 'npc', name: 'Олан', destinations: ['world', 'table'] }), newEntity({ id: 'l', type: 'letter', name: 'Письмо' })] }), 'lorebook', world), 'kk9', kk9)
    const once = enqueueByRoles(base, 'n', NOW)
    expect(once.publications.map((item) => [item.connectionId, item.operation, item.targetType])).toEqual([['lorebook:w-port', 'create', 'character'], ['kk9:k-1', 'create', 'npc-light']])
    expect(enqueueByRoles(once, 'n', NOW).publications).toHaveLength(2)
    expect(enqueueByRoles(base, 'l', NOW).publications).toEqual([])
  })

  it('finds entities not yet sent by the rules', () => {
    const base = withLink(campaign({ entities: [newEntity({ id: 'loc', type: 'location', name: 'Гавань' }), newEntity({ id: 'note', type: 'note', name: 'Заметка' })] }), 'lorebook', world)
    expect(pendingByRoles(base)).toEqual(['loc'])
    expect(pendingByRoles(enqueueByRoles(base, 'loc', NOW))).toEqual([])
  })
})
