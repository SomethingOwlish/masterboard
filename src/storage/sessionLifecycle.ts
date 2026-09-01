import type { CampaignDocument } from './campaignDocuments'
import { canAccessCampaign } from './campaignDocuments'
import { CampaignPermissionError } from './campaignRepository'
import type { DocumentSnapshot, StorageGateway, StorageTransaction } from './gateway'
import type { SessionLogEntry, SessionReview, SessionStatus, TargetSessionDocument } from './sessionDocuments'

function sessionPath(campaignId: string, sessionId: string): string {
  if (!campaignId.trim() || campaignId.includes('/')) throw new Error('Campaign id must be a path segment')
  if (!sessionId.trim() || sessionId.includes('/')) throw new Error('Session id must be a path segment')
  return `campaigns/${campaignId}/sessions/${sessionId}`
}

async function campaignFor(transaction: StorageTransaction, campaignId: string): Promise<CampaignDocument> {
  const campaign = await transaction.get<CampaignDocument>(`campaigns/${campaignId}`)
  if (!campaign) throw new Error(`Campaign ${campaignId} does not exist`)
  return campaign.data
}

function requireCampaignMaster(campaign: CampaignDocument, masterId: string): void {
  if (!canAccessCampaign(campaign, masterId)) throw new CampaignPermissionError('access this session')
}

function requireResponsible(session: TargetSessionDocument, masterId: string): void {
  if (session.responsibleMasterId !== masterId) {
    throw new CampaignPermissionError('edit or conduct this session')
  }
}

function requireStatus(session: TargetSessionDocument, allowed: SessionStatus[], action: string): void {
  if (!allowed.includes(session.status)) throw new Error(`Cannot ${action} while session is ${session.status}`)
}

export class SessionLifecycle {
  constructor(private readonly storage: StorageGateway) {}

  async create(input: {
    campaignId: string
    sessionId: string
    title: string
    responsibleMasterId: string
    now: string
  }): Promise<DocumentSnapshot<TargetSessionDocument>> {
    const path = sessionPath(input.campaignId, input.sessionId)
    await this.storage.runTransaction(async (transaction) => {
      const campaign = await campaignFor(transaction, input.campaignId)
      requireCampaignMaster(campaign, input.responsibleMasterId)
      if (await transaction.get(path)) throw new Error(`Session ${input.sessionId} already exists`)
      const title = input.title.trim()
      if (!title) throw new Error('Session title is required')
      transaction.set<TargetSessionDocument>(path, {
        title,
        status: 'draft',
        responsibleMasterId: input.responsibleMasterId,
        backgroundArcIds: [],
        groupIds: [],
        plan: {},
        actualLog: [],
        review: { notes: '', unresolvedItemIds: [], carryForwardItemIds: [] },
        createdAt: input.now,
        updatedAt: input.now,
      })
    })
    return this.requireSession(path)
  }

  async updatePlan(input: {
    campaignId: string
    sessionId: string
    masterId: string
    plan: Record<string, unknown>
    now: string
  }): Promise<DocumentSnapshot<TargetSessionDocument>> {
    return this.update(input.campaignId, input.sessionId, async (_campaign, session, transaction, path) => {
      requireResponsible(session.data, input.masterId)
      requireStatus(session.data, ['draft', 'prepared', 'running'], 'edit the plan')
      transaction.patch<TargetSessionDocument>(path, { plan: input.plan, updatedAt: input.now }, { revision: session.revision })
    })
  }

  async transition(input: {
    campaignId: string
    sessionId: string
    masterId: string
    to: 'draft' | 'prepared' | 'running' | 'closed'
    now: string
  }): Promise<DocumentSnapshot<TargetSessionDocument>> {
    const allowed: Record<SessionStatus, SessionStatus[]> = {
      draft: ['prepared'], prepared: ['draft', 'running'], running: ['closed'],
      closed: [], review: [], 'review-complete': [],
    }
    return this.update(input.campaignId, input.sessionId, async (_campaign, session, transaction, path) => {
      requireResponsible(session.data, input.masterId)
      if (!allowed[session.data.status].includes(input.to)) {
        throw new Error(`Invalid session transition ${session.data.status} → ${input.to}`)
      }
      transaction.patch<TargetSessionDocument>(path, {
        status: input.to,
        updatedAt: input.now,
        ...(input.to === 'running' ? { startedAt: input.now } : {}),
        ...(input.to === 'closed' ? { closedAt: input.now } : {}),
      }, { revision: session.revision })
    })
  }

  async appendLiveEntry(input: {
    campaignId: string
    sessionId: string
    masterId: string
    entry: SessionLogEntry
    now: string
  }): Promise<DocumentSnapshot<TargetSessionDocument>> {
    return this.update(input.campaignId, input.sessionId, async (_campaign, session, transaction, path) => {
      requireResponsible(session.data, input.masterId)
      requireStatus(session.data, ['running'], 'append to the live log')
      if (session.data.actualLog.some((entry) => entry.id === input.entry.id)) {
        throw new Error(`Session log entry ${input.entry.id} already exists`)
      }
      transaction.patch<TargetSessionDocument>(path, {
        actualLog: [...session.data.actualLog, input.entry], updatedAt: input.now,
      }, { revision: session.revision })
    })
  }

  async transferResponsibility(input: {
    campaignId: string
    sessionId: string
    masterId: string
    nextMasterId: string
    now: string
  }): Promise<DocumentSnapshot<TargetSessionDocument>> {
    return this.update(input.campaignId, input.sessionId, async (campaign, session, transaction, path) => {
      requireResponsible(session.data, input.masterId)
      requireStatus(session.data, ['draft', 'prepared', 'running'], 'transfer responsibility')
      requireCampaignMaster(campaign, input.nextMasterId)
      transaction.patch<TargetSessionDocument>(path, {
        responsibleMasterId: input.nextMasterId, updatedAt: input.now,
      }, { revision: session.revision })
    })
  }

  async updateReview(input: {
    campaignId: string
    sessionId: string
    masterId: string
    review: Partial<Omit<SessionReview, 'completedAt'>>
    now: string
  }): Promise<DocumentSnapshot<TargetSessionDocument>> {
    return this.update(input.campaignId, input.sessionId, async (_campaign, session, transaction, path) => {
      requireResponsible(session.data, input.masterId)
      requireStatus(session.data, ['closed', 'review'], 'edit the review')
      transaction.patch<TargetSessionDocument>(path, {
        status: 'review',
        review: { ...session.data.review, ...input.review, updatedAt: input.now, completedAt: undefined },
        updatedAt: input.now,
      }, { revision: session.revision })
    })
  }

  async completeReview(input: {
    campaignId: string
    sessionId: string
    masterId: string
    now: string
  }): Promise<DocumentSnapshot<TargetSessionDocument>> {
    return this.reviewTransition(input, 'review-complete')
  }

  async reopenReview(input: {
    campaignId: string
    sessionId: string
    masterId: string
    now: string
  }): Promise<DocumentSnapshot<TargetSessionDocument>> {
    return this.reviewTransition(input, 'review')
  }

  private async reviewTransition(
    input: { campaignId: string; sessionId: string; masterId: string; now: string },
    target: 'review' | 'review-complete',
  ): Promise<DocumentSnapshot<TargetSessionDocument>> {
    return this.update(input.campaignId, input.sessionId, async (_campaign, session, transaction, path) => {
      requireResponsible(session.data, input.masterId)
      const expected = target === 'review-complete' ? 'review' : 'review-complete'
      requireStatus(session.data, [expected], target === 'review' ? 'reopen the review' : 'complete the review')
      transaction.patch<TargetSessionDocument>(path, {
        status: target,
        review: {
          ...session.data.review,
          updatedAt: input.now,
          completedAt: target === 'review-complete' ? input.now : undefined,
        },
        updatedAt: input.now,
      }, { revision: session.revision })
    })
  }

  private async update(
    campaignId: string,
    sessionId: string,
    work: (
      campaign: CampaignDocument,
      session: DocumentSnapshot<TargetSessionDocument>,
      transaction: StorageTransaction,
      path: string,
    ) => Promise<void>,
  ): Promise<DocumentSnapshot<TargetSessionDocument>> {
    const path = sessionPath(campaignId, sessionId)
    await this.storage.runTransaction(async (transaction) => {
      const campaign = await campaignFor(transaction, campaignId)
      const session = await transaction.get<TargetSessionDocument>(path)
      if (!session) throw new Error(`Session ${sessionId} does not exist`)
      await work(campaign, session, transaction, path)
    })
    return this.requireSession(path)
  }

  private async requireSession(path: string): Promise<DocumentSnapshot<TargetSessionDocument>> {
    const session = await this.storage.get<TargetSessionDocument>(path)
    if (!session) throw new Error(`Session ${path} does not exist after write`)
    return session
  }
}
