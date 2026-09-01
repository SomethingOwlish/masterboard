import { FakeExternalGateway } from '../adapters/fakeExternal'
import type { CapabilityPassport, ExternalConnection } from '../model/external'
import { PublicationManager } from '../storage/publicationManager'
import { createDemoWorkspace, DEMO_IDS, type DemoWorkspace } from './demoWorkspace'

export function createLocalPublicationDemo(workspace: DemoWorkspace = createDemoWorkspace()) {
  const connection: ExternalConnection = {
    id: DEMO_IDS.connection,
    system: 'lovegame',
    scope: 'campaign',
    externalId: 'fake-lovegame-campaign',
    label: 'Fake Lovegame · Moon Port',
    state: 'active',
  }
  const passport: CapabilityPassport = {
    connectionId: connection.id,
    fetchedAt: '2026-09-01T12:00:00.000Z',
    entities: [
      { entityType: 'npc', label: 'NPC', enabled: true, operations: ['read', 'update', 'change-name', 'change-status'] },
      { entityType: 'rumor', label: 'Rumor', enabled: false, operations: ['read', 'create'], unavailableReason: 'Rumor module is disabled in the fake campaign' },
    ],
  }
  const gateway = new FakeExternalGateway([connection], [passport], new Set([DEMO_IDS.publicationFailure]))
  const manager = new PublicationManager(workspace.storage, gateway)
  const input = () => ({ campaignId: workspace.campaignId, masterId: workspace.activeMasterId })

  return {
    ...workspace,
    connection,
    gateway,
    snapshot: () => manager.snapshot(workspace.campaignId, workspace.activeMasterId),
    preview: () => manager.preview(workspace.campaignId, workspace.activeMasterId, new Date().toISOString()),
    confirm: (ids: string[]) => manager.confirm(workspace.campaignId, workspace.activeMasterId, ids, new Date().toISOString()),
    execute: () => manager.execute(workspace.campaignId, workspace.activeMasterId, new Date().toISOString(), true),
    retry: (ids: string[]) => manager.retry(workspace.campaignId, workspace.activeMasterId, ids, new Date().toISOString()),
    input,
  }
}

