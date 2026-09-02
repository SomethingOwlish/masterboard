import type { CampaignDocument } from '../storage/campaignDocuments'
import { CampaignContentRepository, type CampaignContentDocument } from '../storage/campaignContentRepository'
import { CampaignRepository } from '../storage/campaignRepository'
import type { TargetSessionDocument } from '../storage/sessionDocuments'
import { createDemoWorkspace, DEMO_IDS, type DemoWorkspace } from './demoWorkspace'

export interface DashboardLine extends CampaignContentDocument {
  title: string
  direction: string
  stakes: string
  state: string
}

export interface DashboardClock extends CampaignContentDocument {
  title: string
  value: number
  max: number
  state: string
  visibleToPlayers: boolean
}

export interface DashboardSecret extends CampaignContentDocument {
  title: string
  truth: string
  state: string
  revealConditions: string[]
}

export interface DashboardTask extends CampaignContentDocument {
  title: string
  state: 'todo' | 'doing' | 'done'
  tags: string[]
  order: number
}

export interface DashboardInboxItem extends CampaignContentDocument {
  text: string
  targetType: string
  state: 'unprocessed' | 'processed'
  order: number
}

export interface LocalDashboardSnapshot {
  campaign: CampaignDocument
  session: TargetSessionDocument | null
  lines: DashboardLine[]
  clocks: DashboardClock[]
  secrets: DashboardSecret[]
  tasks: Array<DashboardTask & { id: string }>
  inbox: Array<DashboardInboxItem & { id: string }>
}

function idFromPath(path: string) {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** Network-free dashboard runtime backed by the same target repositories as Firestore will use. */
export function createLocalDashboardDemo(workspace: DemoWorkspace = createDemoWorkspace()) {
  const campaigns = new CampaignRepository(workspace.storage)
  const repo = <T extends CampaignContentDocument>(collection: ConstructorParameters<typeof CampaignContentRepository<T>>[1]) =>
    new CampaignContentRepository<T>(workspace.storage, collection)
  const lines = repo<DashboardLine>('lines')
  const clocks = repo<DashboardClock>('clocks')
  const secrets = repo<DashboardSecret>('secrets')
  const tasks = repo<DashboardTask>('tasks')
  const inbox = repo<DashboardInboxItem>('inbox')
  const sessions = repo<TargetSessionDocument>('sessions')

  const load = async (): Promise<LocalDashboardSnapshot> => {
    const campaign = await campaigns.getForMaster(workspace.campaignId, workspace.activeMasterId)
    if (!campaign) throw new Error('Demo campaign is missing')
    const [lineDocs, clockDocs, secretDocs, taskDocs, inboxDocs, session] = await Promise.all([
      lines.list(workspace.campaignId, workspace.activeMasterId),
      clocks.list(workspace.campaignId, workspace.activeMasterId),
      secrets.list(workspace.campaignId, workspace.activeMasterId),
      tasks.list(workspace.campaignId, workspace.activeMasterId),
      inbox.list(workspace.campaignId, workspace.activeMasterId),
      sessions.get(workspace.campaignId, DEMO_IDS.session, workspace.activeMasterId),
    ])
    return {
      campaign: campaign.data,
      session: session?.data ?? null,
      lines: lineDocs.map((item) => item.data),
      clocks: clockDocs.map((item) => item.data),
      secrets: secretDocs.map((item) => item.data),
      tasks: taskDocs.map((item) => ({ ...item.data, id: idFromPath(item.path) })),
      inbox: inboxDocs.map((item) => ({ ...item.data, id: idFromPath(item.path) })),
    }
  }

  const toggleTask = async (id: string) => {
    const current = await tasks.get(workspace.campaignId, id, workspace.activeMasterId)
    if (!current) throw new Error(`Task ${id} is missing`)
    return tasks.patch(
      workspace.campaignId, id, workspace.activeMasterId,
      { state: current.data.state === 'done' ? 'todo' : 'done' },
      new Date().toISOString(), current.revision,
    )
  }

  const captureInbox = (text: string) => inbox.create(
    workspace.campaignId,
    `inbox-${crypto.randomUUID()}`,
    workspace.activeMasterId,
    { text: text.trim(), targetType: 'idea', state: 'unprocessed', order: Date.now() },
    new Date().toISOString(),
  )

  const updateCampaign = (patch: { name: string; idea: string; activeTime: string }) => campaigns.updateDetails(
    workspace.campaignId, workspace.activeMasterId, patch, new Date().toISOString(),
  )

  return { ...workspace, load, toggleTask, captureInbox, updateCampaign }
}
