import { describe, expect, it } from 'vitest'
import { blankSession, normalizeCampaign, withLocalSessions } from './normalize'
import { completeReview, filterRelations, missingDecisions } from './sessionFlow'
import type { LocalCampaignRecord, LocalSessionPlanItem, LocalSessionRecord } from './types'

const NOW = '2026-09-26T10:00:00.000Z'
const item = (id: string, patch: Partial<LocalSessionPlanItem> = {}): LocalSessionPlanItem => ({ id, source: 'text', text: id, kind: 'scene', priority: 'required', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared', ...patch })

function campaignWith(session: Partial<LocalSessionRecord>, others: LocalSessionRecord[] = []): LocalCampaignRecord {
  const base = normalizeCampaign({ id: 'c', name: 'Кампания', notes: [] }, NOW)!
  return withLocalSessions(base, [{ ...blankSession(1, 'Сова', NOW, 'session-1'), title: 'Первая', status: 'completed', ...session }, ...others], 'session-1')
}

describe('review', () => {
  const planItems = [item('played', { status: 'used' }), item('carry'), item('lib', { kind: 'npc', text: 'Бран' }), item('cancel'), item('keep', { priority: 'desired' }), item('extra', { priority: 'useful' })]

  it('lists only unplayed required and desired items as needing decisions', () => {
    const campaign = campaignWith({ planItems })
    expect(missingDecisions(campaign.sessionRecords[0]).map((entry) => entry.id)).toEqual(['carry', 'lib', 'cancel', 'keep'])
    expect(() => completeReview(campaign, 'session-1', { target: 'new', now: NOW })).toThrow('Не по всем пунктам')
  })

  it('applies every decision and carries items into a new session', () => {
    const campaign = campaignWith({ planItems, reviewDecisions: { carry: 'carry', lib: 'library', cancel: 'cancel', keep: 'keep' } })
    const next = completeReview(campaign, 'session-1', { target: 'new', now: NOW })
    const [first, second] = next.sessionRecords
    expect(first.reviewStatus).toBe('completed')
    expect(Object.fromEntries(first.planItems.map((entry) => [entry.id, entry.status]))).toMatchObject({ played: 'used', carry: 'moved', lib: 'skipped', cancel: 'cancelled', keep: 'skipped', extra: 'prepared' })
    expect(second).toMatchObject({ number: 2, status: 'draft' })
    expect(second.planItems).toEqual([expect.objectContaining({ text: 'carry', status: 'prepared', origin: 'review', carriedFromSessionId: 'session-1' })])
    expect(first.nextSessionId).toBe(second.id)
    expect(next.activeSessionId).toBe(second.id)
    expect(next.entities).toEqual([expect.objectContaining({ type: 'npc', name: 'Бран', origin: { kind: 'plan', sessionId: 'session-1' } })])
    expect(first.planItems.find((entry) => entry.id === 'lib')?.entityId).toBe(next.entities[0].id)
  })

  it('does not duplicate carried items when a review is reopened and closed again', () => {
    const campaign = campaignWith({ planItems: [item('carry')], reviewDecisions: { carry: 'carry' } })
    const once = completeReview(campaign, 'session-1', { target: 'new', now: NOW })
    const reopened = { ...once, sessionRecords: once.sessionRecords.map((session) => session.id === 'session-1' ? { ...session, reviewStatus: 'draft' as const } : session) }
    const twice = completeReview(reopened, 'session-1', { target: 'new', now: NOW })
    expect(twice.sessionRecords).toHaveLength(2)
    expect(twice.sessionRecords[1].planItems).toHaveLength(1)
  })

  it('can carry items into an existing draft session', () => {
    const draft = { ...blankSession(2, 'Сова', NOW, 'session-2'), title: 'Вторая' }
    const campaign = campaignWith({ planItems: [item('carry')], reviewDecisions: { carry: 'carry' } }, [draft])
    const next = completeReview(campaign, 'session-1', { target: 'session-2', now: NOW })
    expect(next.sessionRecords).toHaveLength(2)
    expect(next.sessionRecords[1].planItems.map((entry) => entry.text)).toEqual(['carry'])
  })
})

describe('relations', () => {
  it('filters by visibility, type and entity, and migrates old relations', () => {
    const campaign = normalizeCampaign({ id: 'c', name: 'К', notes: [], relations: [{ id: 'r1', fromId: 'a', toId: 'b', label: 'дружат', visibility: 'public' }, { id: 'r2', fromId: 'b', toId: 'c', label: 'враги', type: 'enmity', direction: 'mutual', visibility: 'master' }] }, NOW)!
    expect(campaign.relations[0]).toMatchObject({ type: 'other', direction: 'directed' })
    expect(filterRelations(campaign.relations, { visibility: 'all', type: 'enmity', entityId: '' }).map((relation) => relation.id)).toEqual(['r2'])
    expect(filterRelations(campaign.relations, { visibility: 'public', type: 'all', entityId: '' }).map((relation) => relation.id)).toEqual(['r1'])
    expect(filterRelations(campaign.relations, { visibility: 'all', type: 'all', entityId: 'c' }).map((relation) => relation.id)).toEqual(['r2'])
  })
})
