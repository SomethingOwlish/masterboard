// КК9 как источник Masterboard (этап М2): что куда ложится при импорте.
import { describe, expect, it } from 'vitest'
import { importType, SYSTEM_LABEL, targetTypes, WRITABLE_SYSTEMS, LINKABLE_SYSTEMS } from './integration'

describe('КК9 глазами Masterboard', () => {
  it('персонаж, НПС и сцена-место ложатся своими типами', () => {
    expect(importType('kk9', 'character')).toBe('character')
    expect(importType('kk9', 'npc')).toBe('npc')
    expect(importType('kk9', 'place')).toBe('location')
  })
  it('КК9 связывается с кампанией, но публикации туда пока нет (М3)', () => {
    expect(LINKABLE_SYSTEMS).toContain('kk9')
    expect(WRITABLE_SYSTEMS).not.toContain('kk9')
    expect(SYSTEM_LABEL.kk9).toBe('КК9')
  })
  it('таблица типов назначения не падает на системе без неё', () => {
    expect(targetTypes(undefined, 'kk9', 'npc')).toEqual([])
  })
})
