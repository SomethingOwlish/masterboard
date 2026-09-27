import { describe, expect, it } from 'vitest'
import { newSecret } from './domain'
import { blankSession, normalizeCampaign, withLocalSessions } from './normalize'
import { duplicateSession, liveSessions, nextSessionNumber, purgeSessions, restoreSession, startSession, trashSession, trashedSessions, validSessionDate } from './sessions'
import type { LocalCampaignRecord, LocalSessionPlanItem, LocalSessionRecord } from './types'

const NOW = '2026-09-26T10:00:00.000Z'
const item = (id: string, patch: Partial<LocalSessionPlanItem> = {}): LocalSessionPlanItem => ({ id, source: 'text', text: id, kind: 'scene', priority: 'required', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared', ...patch })
const session = (id: string, number: number, patch: Partial<LocalSessionRecord> = {}): LocalSessionRecord => ({ ...blankSession(number, 'm', NOW, id), title: id, ...patch })

function campaignWith(...sessions: LocalSessionRecord[]): LocalCampaignRecord {
  return withLocalSessions(normalizeCampaign({ id: 'c', name: 'Кампания' }, NOW)!, sessions, sessions[0]?.id)
}

describe('session dates', () => {
  it('accepts real calendar days and rejects impossible ones', () => {
    expect(validSessionDate('')).toBe(true)
    expect(validSessionDate('2028-02-29')).toBe(true)
    expect(validSessionDate('2026-02-30')).toBe(false)
    expect(validSessionDate('2026-13-01')).toBe(false)
    expect(validSessionDate('01.10.2026')).toBe(false)
  })

  it('drops an invalid stored date instead of keeping garbage', () => {
    const campaign = normalizeCampaign({ id: 'c', name: 'К', sessionRecords: [{ id: 'a', date: '2026-02-30' }, { id: 'b', date: '2026-10-01' }] }, NOW)!
    expect(campaign.sessionRecords.map((entry) => entry.date)).toEqual(['', '2026-10-01'])
  })
})

describe('duplicating a session', () => {
  it('remaps scenes, arrows and graph positions while clearing play history', () => {
    const original = session('a', 1, {
      status: 'completed', date: '2026-10-01', reviewStatus: 'completed', reviewNotes: 'Итоги', reviewDecisions: { x: 'carry' },
      log: [{ id: 'log', text: 'Сыграно', kind: 'moment', createdAt: NOW }],
      planItems: [item('scene-1'), item('npc', { kind: 'npc', sceneId: 'scene-1', status: 'used', carriedFromSessionId: 'old' }), item('scene-2')],
      flows: [{ id: 'f', fromItemId: 'scene-1', toItemId: 'scene-2', condition: 'если сбегут' }],
      planLayout: { 'scene-1': { x: 7, y: 9 } },
    })
    const next = duplicateSession(campaignWith(original), 'a', NOW)
    const copy = next.sessionRecords[1]
    const [scene1, npc, scene2] = copy.planItems
    expect(next.activeSessionId).toBe(copy.id)
    expect(copy).toMatchObject({ number: 2, title: 'a (копия)', status: 'draft', date: '', log: [], reviewNotes: '', reviewStatus: 'draft', reviewDecisions: {} })
    expect(scene1.id).not.toBe('scene-1')
    expect(npc).toMatchObject({ sceneId: scene1.id, status: 'prepared' })
    expect(npc.carriedFromSessionId).toBeUndefined()
    expect(copy.flows).toEqual([expect.objectContaining({ fromItemId: scene1.id, toItemId: scene2.id, condition: 'если сбегут' })])
    expect(copy.flows[0].id).not.toBe('f')
    expect(copy.planLayout).toEqual({ [scene1.id]: { x: 7, y: 9 } })
    expect(next.sessionRecords[0]).toBe(original)
  })
})

describe('session trash', () => {
  it('restores a trashed session and never reuses its number', () => {
    let campaign = campaignWith(session('first', 1))
    campaign = trashSession(campaign, 'first', NOW)
    expect(liveSessions(campaign)).toEqual([])
    expect(trashedSessions(campaign).map((entry) => entry.id)).toEqual(['first'])
    expect(campaign.activeSessionId).toBeUndefined()
    expect(nextSessionNumber(campaign)).toBe(2)
    campaign = restoreSession(withLocalSessions(campaign, [...campaign.sessionRecords, session('second', 2)]), 'first')
    expect(liveSessions(campaign).map((entry) => entry.number)).toEqual([1, 2])
    expect(campaign.sessionRecords[0].deletedAt).toBeUndefined()
    expect(campaign.activeSessionId).toBe('first')
  })

  it('keeps the trash mark through a reload and skips trashed sessions when picking the active one', () => {
    const stored = trashSession(campaignWith(session('a', 1), session('b', 2)), 'a', NOW)
    const reloaded = normalizeCampaign(JSON.parse(JSON.stringify({ ...stored, activeSessionId: 'a' })), NOW)!
    expect(reloaded.sessionRecords[0].deletedAt).toBe(NOW)
    expect(reloaded.activeSessionId).toBe('b')
  })

  it('refuses to trash a game in progress', () => {
    expect(() => trashSession(campaignWith(session('a', 1, { status: 'active' })), 'a', NOW)).toThrow('завершите')
  })
})

describe('running a session', () => {
  it('allows preparing during play but only one game at a time', () => {
    const campaign = campaignWith(session('a', 1, { status: 'active' }), session('b', 2, { status: 'ready' }))
    expect(() => startSession(campaign, 'b')).toThrow('уже идёт')
    const finished = withLocalSessions(campaign, [{ ...campaign.sessionRecords[0], status: 'completed' }, campaign.sessionRecords[1]])
    expect(startSession(finished, 'b').sessionRecords[1].status).toBe('active')
  })

  it('ignores a trashed game when checking for a running one, but will not start a trashed session', () => {
    const campaign = campaignWith(session('a', 1, { status: 'active', deletedAt: NOW }), session('b', 2))
    expect(startSession(campaign, 'b').sessionRecords[1].status).toBe('active')
    expect(() => startSession(campaign, 'a')).toThrow('корзине')
  })
})

describe('deleting from the trash', () => {
  it('removes only trashed sessions for good and unlinks them from secrets', () => {
    let campaign = campaignWith(session('a', 1), session('b', 2), session('c', 3))
    campaign = { ...campaign, secrets: [newSecret({ title: 'Тайна', sessionIds: ['a', 'b'] })] }
    campaign = trashSession(trashSession(campaign, 'b', NOW), 'c', NOW)
    const purged = purgeSessions(campaign, ['a', 'b'])
    expect(purged.sessionRecords.map((item) => item.id)).toEqual(['a', 'c'])
    expect(purged.secrets[0].sessionIds).toEqual(['a'])
    expect(trashedSessions(purgeSessions(purged, ['c']))).toEqual([])
    expect(purgeSessions(campaign, ['a'])).toBe(campaign)
  })
})
