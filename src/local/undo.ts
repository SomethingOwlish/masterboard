import { mergeCampaign } from './merge'
import type { LocalCampaignRecord } from './types'

type Obj = Record<string, unknown>

/**
 * «Отменить» after a simple delete: when nothing changed since, the campaign
 * goes back to `before` exactly; otherwise what `before` had and `after` lost
 * is merged into `current`, so edits made in the meantime stay.
 */
export function restoreRemoved(before: LocalCampaignRecord, after: LocalCampaignRecord, current: LocalCampaignRecord): LocalCampaignRecord {
  if (current === after) return before
  return mergeCampaign(after as unknown as Obj, before as unknown as Obj, current as unknown as Obj).merged as unknown as LocalCampaignRecord
}
