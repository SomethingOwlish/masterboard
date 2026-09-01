import type { DocumentSnapshot } from '../storage/gateway'
import type { TargetSessionDocument } from '../storage/sessionDocuments'
import { SessionLifecycle } from '../storage/sessionLifecycle'
import { createDemoWorkspace, DEMO_IDS, type DemoWorkspace } from './demoWorkspace'

const INITIAL_TIME = '2026-09-01T18:00:00.000Z'

/** Isolated, network-free runtime for exercising the target session model in UI tests. */
export function createLocalSessionDemo(workspace: DemoWorkspace = createDemoWorkspace()) {
  const lifecycle = new SessionLifecycle(workspace.storage)
  const path = `campaigns/${workspace.campaignId}/sessions/${DEMO_IDS.session}`
  let setup: Promise<DocumentSnapshot<TargetSessionDocument>> | null = null

  const ensureSession = () => {
    setup ??= (async () => {
      const existing = await workspace.storage.get<TargetSessionDocument>(path)
      if (existing) return existing
      await lifecycle.create({
        campaignId: workspace.campaignId,
        sessionId: DEMO_IDS.session,
        title: 'Opening Night at Moon Port',
        responsibleMasterId: workspace.activeMasterId,
        now: INITIAL_TIME,
      })
      return lifecycle.updatePlan({
        campaignId: workspace.campaignId,
        sessionId: DEMO_IDS.session,
        masterId: workspace.activeMasterId,
        plan: {
          objective: 'Open the eastern gate and introduce the Silver Fox.',
          opening: 'The red tide reaches the lantern stairs at midnight.',
        },
        now: INITIAL_TIME,
      })
    })()
    return setup
  }

  return {
    ...workspace,
    lifecycle,
    sessionId: DEMO_IDS.session,
    ownerId: DEMO_IDS.owner,
    coMasterId: DEMO_IDS.coMaster,
    ensureSession,
    readSession: () => workspace.storage.get<TargetSessionDocument>(path),
  }
}
