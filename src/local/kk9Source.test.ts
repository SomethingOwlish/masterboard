// КК9 как источник Masterboard (этап М2): что куда ложится при импорте.
import { describe, expect, it } from 'vitest'
import type { CapabilityOperation, CapabilityPassport } from '../model/external'
import { importType, SYSTEM_LABEL, targetTypes, WRITABLE_SYSTEMS, LINKABLE_SYSTEMS } from './integration'

describe('КК9 глазами Masterboard', () => {
  it('персонаж, виды библиотеки и сцена-место ложатся своими типами', () => {
    expect(importType('kk9', 'character')).toBe('character')
    for (const kind of ['npc-light', 'npc-hard', 'npc-boss', 'curator', 'npc-board', 'npc']) expect(importType('kk9', kind)).toBe('npc')
    expect(importType('kk9', 'companion')).toBe('creature')
    expect(importType('kk9', 'daemon')).toBe('creature')
    expect(importType('kk9', 'place')).toBe('location')
  })
  it('КК9 связывается с кампанией и принимает публикацию (М3)', () => {
    expect(LINKABLE_SYSTEMS).toContain('kk9')
    expect(WRITABLE_SYSTEMS).toContain('kk9')
    expect(SYSTEM_LABEL.kk9).toBe('КК9')
  })
  it('у каждого вида НПС своё назначение: по умолчанию лёгкий, выбрать можно любой', () => {
    const rw: CapabilityOperation[] = ['read', 'create', 'update', 'change-visibility']
    const passport: CapabilityPassport = { connectionId: 'kk9:k1', fetchedAt: '', entities: [
      { entityType: 'npc-light', label: 'Лёгкий НПС', enabled: true, operations: rw },
      { entityType: 'npc-hard', label: 'Тяжёлый НПС', enabled: true, operations: rw },
      { entityType: 'npc-boss', label: 'Босс', enabled: true, operations: rw },
      { entityType: 'companion', label: 'Спутник', enabled: true, operations: rw },
      { entityType: 'item', label: 'Предмет', enabled: true, operations: ['create', 'update'] },
      { entityType: 'place', label: 'Место', enabled: true, operations: ['read'] },
    ] }
    const npc = targetTypes(passport, 'kk9', 'npc').map((t) => t.id)
    expect(npc[0]).toBe('npc-light')
    expect(npc).toEqual(expect.arrayContaining(['npc-hard', 'npc-boss', 'companion']))
    expect(targetTypes(passport, 'kk9', 'creature')[0].id).toBe('companion')
    expect(targetTypes(passport, 'kk9', 'item')[0].id).toBe('item')
    expect(targetTypes(passport, 'kk9', 'location').map((t) => t.id)).not.toContain('place')
  })
})
