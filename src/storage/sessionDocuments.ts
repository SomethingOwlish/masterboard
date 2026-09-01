import type { CampaignContentDocument } from './campaignContentRepository'

export type SessionStatus =
  | 'draft'
  | 'prepared'
  | 'running'
  | 'closed'
  | 'review'
  | 'review-complete'

export interface SessionLogEntry {
  id: string
  at: string
  kind: 'note' | 'scene' | 'event' | 'clock' | 'secret' | 'consequence' | 'task' | 'material'
  text: string
  source: 'prepared' | 'during-session' | 'review'
}

export interface SessionReview {
  notes: string
  unresolvedItemIds: string[]
  carryForwardItemIds: string[]
  updatedAt?: string
  completedAt?: string
}

export interface TargetSessionDocument extends CampaignContentDocument {
  title: string
  status: SessionStatus
  responsibleMasterId: string
  primaryArcId?: string
  backgroundArcIds: string[]
  groupIds: string[]
  plan: Record<string, unknown>
  actualLog: SessionLogEntry[]
  review: SessionReview
  startedAt?: string
  closedAt?: string
}
