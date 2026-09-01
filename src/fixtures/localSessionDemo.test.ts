import { describe, expect, it } from 'vitest'
import { createLocalSessionDemo } from './localSessionDemo'

describe('local session demo runtime', () => {
  it('starts from the same prepared story data in every isolated runtime', async () => {
    const first = createLocalSessionDemo()
    const second = createLocalSessionDemo()

    const [left, right] = await Promise.all([first.ensureSession(), second.ensureSession()])

    expect(left.data).toEqual(right.data)
    expect(left.data).toMatchObject({
      title: 'Opening Night at Moon Port',
      status: 'draft',
      responsibleMasterId: first.ownerId,
      plan: { objective: expect.stringContaining('eastern gate') },
    })
  })

  it('keeps mutations local to one runtime and supports the full happy path', async () => {
    const demo = createLocalSessionDemo()
    await demo.ensureSession()
    await demo.lifecycle.transition({
      campaignId: demo.campaignId, sessionId: demo.sessionId, masterId: demo.ownerId,
      to: 'prepared', now: '2026-09-01T18:30:00.000Z',
    })
    await demo.lifecycle.transition({
      campaignId: demo.campaignId, sessionId: demo.sessionId, masterId: demo.ownerId,
      to: 'running', now: '2026-09-01T19:00:00.000Z',
    })
    await demo.lifecycle.appendLiveEntry({
      campaignId: demo.campaignId, sessionId: demo.sessionId, masterId: demo.ownerId,
      now: '2026-09-01T19:15:00.000Z',
      entry: { id: 'demo-entry', at: '2026-09-01T19:15:00.000Z', kind: 'event', text: 'The gate opened.', source: 'during-session' },
    })
    await demo.lifecycle.transition({
      campaignId: demo.campaignId, sessionId: demo.sessionId, masterId: demo.ownerId,
      to: 'closed', now: '2026-09-01T22:00:00.000Z',
    })
    await demo.lifecycle.updateReview({
      campaignId: demo.campaignId, sessionId: demo.sessionId, masterId: demo.ownerId,
      review: { notes: 'Carry the red tide forward.' }, now: '2026-09-01T22:05:00.000Z',
    })
    const complete = await demo.lifecycle.completeReview({
      campaignId: demo.campaignId, sessionId: demo.sessionId, masterId: demo.ownerId,
      now: '2026-09-01T22:10:00.000Z',
    })

    expect(complete.data.status).toBe('review-complete')
    expect(complete.data.actualLog).toHaveLength(1)
    expect(complete.data.review.notes).toContain('red tide')

    const fresh = await createLocalSessionDemo().ensureSession()
    expect(fresh.data.status).toBe('draft')
    expect(fresh.data.actualLog).toEqual([])
  })
})

