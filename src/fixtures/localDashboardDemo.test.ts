import { describe, expect, it } from 'vitest'
import { createLocalDashboardDemo } from './localDashboardDemo'
import { createDemoWorkspace } from './demoWorkspace'
import { createLocalSessionDemo } from './localSessionDemo'

describe('local campaign dashboard runtime', () => {
  it('aggregates the campaign dashboard from target subcollections', async () => {
    const snapshot = await createLocalDashboardDemo().load()
    expect(snapshot.campaign).toMatchObject({ name: 'Moon Port', activeTime: expect.stringContaining('Lantern Festival') })
    expect(snapshot.session).toMatchObject({ title: 'Opening Night at Moon Port', status: 'draft' })
    expect(snapshot.lines[0]).toMatchObject({ title: 'The red tide', state: 'active' })
    expect(snapshot.clocks[0]).toMatchObject({ value: 3, max: 6 })
    expect(snapshot.secrets[0]).toMatchObject({ state: 'hidden' })
  })

  it('supports quick task completion and inbox capture without leaking between runtimes', async () => {
    const demo = createLocalDashboardDemo()
    const before = await demo.load()
    await demo.toggleTask(before.tasks[0].id)
    await demo.captureInbox('A bell rings under the harbor')
    const after = await demo.load()

    expect(after.tasks[0].state).not.toBe(before.tasks[0].state)
    expect(after.inbox).toHaveLength(before.inbox.length + 1)

    const fresh = await createLocalDashboardDemo().load()
    expect(fresh.inbox).toHaveLength(before.inbox.length)
  })

  it('reflects session changes when dashboard and session screens share one runtime', async () => {
    const workspace = createDemoWorkspace()
    const dashboard = createLocalDashboardDemo(workspace)
    const session = createLocalSessionDemo(workspace)
    await session.ensureSession()
    await session.lifecycle.transition({
      campaignId: session.campaignId, sessionId: session.sessionId, masterId: session.ownerId,
      to: 'prepared', now: '2026-09-01T18:30:00.000Z',
    })

    expect((await dashboard.load()).session?.status).toBe('prepared')
  })

  it('edits campaign details through the target repository', async () => {
    const demo = createLocalDashboardDemo()
    await demo.updateCampaign({ name: 'Лунная гавань', idea: 'Новая идея', activeTime: 'Четвёртая ночь' })
    expect((await demo.load()).campaign).toMatchObject({ name: 'Лунная гавань', idea: 'Новая идея', activeTime: 'Четвёртая ночь' })
  })
})
