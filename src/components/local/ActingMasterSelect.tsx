import { Select } from '../../ds'
import { useActing } from '../../local/actingContext'
import type { LocalCampaignRecord } from '../../local/types'

/** Compact "who am I" picker for the campaign header. */
export function ActingMasterSelect({ campaign }: { campaign: LocalCampaignRecord }) {
  const acting = useActing(campaign)
  if (campaign.masters.length < 2) return null
  return <label className="acting-master"><span>Вы:</span><Select aria-label="Кто работает в этом браузере" value={acting.master.id} onChange={(e) => acting.setMasterId(e.target.value)}>{campaign.masters.map((master) => <option key={master.id} value={master.id}>{master.name}{master.role === 'owner' ? ' (владелец)' : ''}</option>)}</Select></label>
}
