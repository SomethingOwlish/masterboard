import { useEffect, useState, type ReactNode } from 'react'
import { ActingContext, readActing, writeActing } from './actingContext'
import type { LocalCampaignRecord } from './types'

export function ActingProvider({ campaign, children }: { campaign: LocalCampaignRecord; children: ReactNode }) {
  const [masterId, setMasterIdState] = useState(() => readActing(campaign))
  useEffect(() => { setMasterIdState(readActing(campaign)) }, [campaign.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const setMasterId = (id: string) => { setMasterIdState(id); writeActing(campaign.id, id) }
  return <ActingContext.Provider value={{ masterId, setMasterId }}>{children}</ActingContext.Provider>
}
