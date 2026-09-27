// КК9 как источник Masterboard (этап М2): что куда ложится при импорте.
import { describe, expect, it } from 'vitest'
import { importType, SYSTEM_LABEL, targetTypes, WRITABLE_SYSTEMS, LINKABLE_SYSTEMS } from './integration'

describe('КК9 глазами Masterboard', () => {
  it('персонаж, НПС и сцена-место ложатся своими типами', () => {
    expect(importType('kk9', 'character')).toBe('character')
    expect(importType('kk9', 'npc')).toBe('npc')
    expect(importType('kk9', 'place')).toBe('location')
  })
  it('КК9 связывается с кампанией и принимает публикацию (М3)', () => {
    expect(LINKABLE_SYSTEMS).toContain('kk9')
    expect(WRITABLE_SYSTEMS).toContain('kk9')
    expect(SYSTEM_LABEL.kk9).toBe('КК9')
  })
  it('НПС и предмет едут своими типами; паспорт решает, что принимается', () => {
    const passport = { connectionId: 'kk9:k1', fetchedAt: '', entities: [
      { entityType: 'npc', label: 'НПС', enabled: true, operations: ['read', 'create', 'update'] as const },
      { entityType: 'item', label: 'Предмет', enabled: true, operations: ['create', 'update'] as const },
      { entityType: 'place', label: 'Место', enabled: true, operations: ['read'] as const },
    ].map((e) => ({ ...e, operations: [...e.operations] })) }
    expect(targetTypes(passport, 'kk9', 'item').map((t) => t.id)).toEqual(['item', 'npc'])
    expect(targetTypes(passport, 'kk9', 'character')[0].id).toBe('npc')
    expect(targetTypes(passport, 'kk9', 'location').map((t) => t.id)).not.toContain('place')
  })
})
