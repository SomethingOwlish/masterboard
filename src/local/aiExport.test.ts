import { describe, expect, it } from 'vitest'
import { AI_EXPORT_FORMAT, exportSessionResults } from './aiExport'
import { newClock, newEntity, newSecret } from './domain'
import { blankSession, normalizeCampaign, withLocalSessions } from './normalize'
import { logEntry, newTask } from './sessionFlow'
import type { LocalCampaignRecord, LocalSessionRecord } from './types'

const NOW = '2026-10-08T10:00:00.000Z'

function campaign(): LocalCampaignRecord {
  const base = normalizeCampaign({ id: 'c', name: 'Туманный порт' }, NOW)!
  const irma = newEntity({ id: 'irma', type: 'npc', name: 'Капитан Ирма', origin: { kind: 'live', sessionId: 's2' } })
  const clock = newClock({ id: 'riot', title: 'Бунт', value: 3, segments: 6 })
  const secret = newSecret({ id: 'plague', title: 'Источник чумы', truth: 'Колодец отравлен', reveals: [{ id: 'r', status: 'everyone', recipients: '', recipientIds: [], sessionId: 's2', note: 'нашли записку', createdAt: NOW }] })
  const second: LocalSessionRecord = {
    ...blankSession(2, 'm', NOW, 's2'),
    title: 'Мост в тумане',
    status: 'completed',
    planItems: [{ id: 'p1', source: 'library', entityId: 'irma', text: 'засада на мосту', kind: 'scene', priority: 'required', status: 'skipped', role: '', alternative: '', note: '', origin: 'prepared' }],
    reviewDecisions: { p1: 'carry' },
    log: [logEntry('decision', 'Отпустили Ирму', NOW, { entityId: 'irma' }), logEntry('clock', 'Часы «Бунт» +1', NOW, { clockId: 'riot' })],
    reviewNotes: 'Игроки сочувствуют Ирме',
  }
  const first: LocalSessionRecord = { ...blankSession(1, 'm', NOW, 's1'), title: 'Встреча у ворот' }
  const trashed: LocalSessionRecord = { ...blankSession(3, 'm', NOW, 's3'), title: 'Удалённая', deletedAt: NOW }
  return { ...withLocalSessions(base, [second, first, trashed], 's2'), entities: [irma], clocks: [clock], secrets: [secret], tasks: [newTask('Решить судьбу Ирмы', 'session', { sessionId: 's2' })] }
}

describe('session results for AI', () => {
  it('exports every live session in order, with names instead of ids', () => {
    const data = JSON.parse(exportSessionResults(campaign(), NOW))
    expect(data.format).toBe(AI_EXPORT_FORMAT)
    expect(data.about).toMatch(/ИИ/)
    expect(data.sessions.map((item: { number: number }) => item.number)).toEqual([1, 2])
    const played = data.sessions[1]
    expect(played.plan[0]).toMatchObject({ title: 'Капитан Ирма', details: 'засада на мосту', status: 'Пропущено', reviewDecision: 'Перенести в следующую' })
    expect(played.log[0]).toMatchObject({ kind: 'Решение', text: 'Отпустили Ирму', entity: 'Капитан Ирма' })
    expect(played.clockChanges).toEqual([{ clock: 'Бунт', change: 'Часы «Бунт» +1', nowAt: '3/6' }])
    expect(played.secretsRevealed[0]).toMatchObject({ secret: 'Источник чумы', truth: 'Колодец отравлен', status: 'Всем героям' })
    expect(played.createdEntities[0]).toMatchObject({ name: 'Капитан Ирма', type: 'NPC' })
    expect(played.tasks).toEqual([{ text: 'Решить судьбу Ирмы', done: false }])
    expect(played.review.notes).toBe('Игроки сочувствуют Ирме')
    expect(JSON.stringify(data)).not.toMatch(/"(irma|riot|plague)"/)
  })

  it('exports a single session and leaves out empty fields', () => {
    const data = JSON.parse(exportSessionResults(campaign(), NOW, 's1'))
    expect(data.sessions).toHaveLength(1)
    expect(data.sessions[0].title).toBe('Встреча у ворот')
    expect(data.sessions[0]).not.toHaveProperty('log')
    expect(data.sessions[0]).not.toHaveProperty('opening')
  })
})
