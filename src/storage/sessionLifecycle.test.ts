import { describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { CampaignPermissionError } from './campaignRepository'
import { SessionLifecycle } from './sessionLifecycle'

const CAMPAIGN = 'camp-1'
const SESSION = 'session-1'
const NOW = '2026-09-01T16:00:00.000Z'

function setup() {
  const storage = new MemoryStorageGateway({
    [`campaigns/${CAMPAIGN}`]: {
      name: 'Campaign', mode: 'single-group', ownerId: 'owner', coMasterId: 'co-master',
      createdAt: NOW, updatedAt: NOW,
    },
  })
  return { storage, lifecycle: new SessionLifecycle(storage) }
}

async function create(lifecycle: SessionLifecycle, responsibleMasterId = 'owner') {
  return lifecycle.create({
    campaignId: CAMPAIGN, sessionId: SESSION, title: 'Opening Night', responsibleMasterId, now: NOW,
  })
}

describe('SessionLifecycle', () => {
  it('creates a minimal draft assigned to one campaign master', async () => {
    const { lifecycle } = setup()
    const session = await create(lifecycle, 'co-master')
    expect(session.data).toMatchObject({
      title: 'Opening Night', status: 'draft', responsibleMasterId: 'co-master',
      actualLog: [], review: { notes: '', unresolvedItemIds: [], carryForwardItemIds: [] },
    })
    await expect(create(lifecycle, 'outsider')).rejects.toBeInstanceOf(CampaignPermissionError)
  })

  it('follows the preparation and live-session transitions', async () => {
    const { lifecycle } = setup()
    await create(lifecycle)
    await lifecycle.transition({ campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', to: 'prepared', now: NOW })
    const running = await lifecycle.transition({
      campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', to: 'running', now: '2026-09-01T17:00:00.000Z',
    })
    expect(running.data).toMatchObject({ status: 'running', startedAt: '2026-09-01T17:00:00.000Z' })
    const closed = await lifecycle.transition({
      campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', to: 'closed', now: '2026-09-01T20:00:00.000Z',
    })
    expect(closed.data).toMatchObject({ status: 'closed', closedAt: '2026-09-01T20:00:00.000Z' })
  })

  it('rejects invalid lifecycle jumps', async () => {
    const { lifecycle } = setup()
    await create(lifecycle)
    await expect(lifecycle.transition({
      campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', to: 'running', now: NOW,
    })).rejects.toThrow('Invalid session transition draft → running')
  })

  it('edits session details before play and locks them once running', async () => {
    const { lifecycle } = setup(); await create(lifecycle)
    const edited = await lifecycle.updateDetails({ campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', title: 'Новая встреча', now: NOW })
    expect(edited.data.title).toBe('Новая встреча')
    await lifecycle.transition({ campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', to: 'prepared', now: NOW })
    await lifecycle.transition({ campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', to: 'running', now: NOW })
    await expect(lifecycle.updateDetails({ campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', title: 'Поздняя правка', now: NOW })).rejects.toThrow('Cannot edit session details while session is running')
  })

  it('allows only the responsible master to edit and conduct while co-master watches', async () => {
    const { lifecycle } = setup()
    await create(lifecycle)
    await expect(lifecycle.updatePlan({
      campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'co-master', plan: { goal: 'Watch' }, now: NOW,
    })).rejects.toBeInstanceOf(CampaignPermissionError)
    await lifecycle.updatePlan({
      campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', plan: { goal: 'Play' }, now: NOW,
    })
  })

  it('transfers responsibility explicitly to the other campaign master', async () => {
    const { lifecycle } = setup()
    await create(lifecycle)
    const transferred = await lifecycle.transferResponsibility({
      campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', nextMasterId: 'co-master', now: NOW,
    })
    expect(transferred.data.responsibleMasterId).toBe('co-master')
    await expect(lifecycle.transferResponsibility({
      campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'co-master', nextMasterId: 'outsider', now: NOW,
    })).rejects.toBeInstanceOf(CampaignPermissionError)
  })

  it('accepts live log entries only while running and keeps them immutable after close', async () => {
    const { lifecycle } = setup()
    await create(lifecycle)
    await lifecycle.transition({ campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', to: 'prepared', now: NOW })
    await lifecycle.transition({ campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', to: 'running', now: NOW })
    await lifecycle.appendLiveEntry({
      campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', now: NOW,
      entry: { id: 'log-1', at: NOW, kind: 'event', text: 'The gate opened', source: 'during-session' },
    })
    await lifecycle.transition({ campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', to: 'closed', now: NOW })
    await expect(lifecycle.appendLiveEntry({
      campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', now: NOW,
      entry: { id: 'log-2', at: NOW, kind: 'note', text: 'Late edit', source: 'review' },
    })).rejects.toThrow('Cannot append to the live log while session is closed')
    await expect(lifecycle.updatePlan({
      campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', plan: { changed: true }, now: NOW,
    })).rejects.toThrow('Cannot edit the plan while session is closed')
  })

  it('supports draft review, completion, and reopening without editing the factual log', async () => {
    const { lifecycle } = setup()
    await create(lifecycle)
    await lifecycle.transition({ campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', to: 'prepared', now: NOW })
    await lifecycle.transition({ campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', to: 'running', now: NOW })
    await lifecycle.transition({ campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', to: 'closed', now: NOW })
    const review = await lifecycle.updateReview({
      campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', now: NOW,
      review: { notes: 'Carry the clock forward', carryForwardItemIds: ['clock-1'] },
    })
    expect(review.data).toMatchObject({ status: 'review', review: { notes: 'Carry the clock forward' } })
    const complete = await lifecycle.completeReview({
      campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', now: NOW,
    })
    expect(complete.data).toMatchObject({ status: 'review-complete', review: { completedAt: NOW } })
    const reopened = await lifecycle.reopenReview({
      campaignId: CAMPAIGN, sessionId: SESSION, masterId: 'owner', now: NOW,
    })
    expect(reopened.data).toMatchObject({ status: 'review', review: { completedAt: undefined } })
  })
})
