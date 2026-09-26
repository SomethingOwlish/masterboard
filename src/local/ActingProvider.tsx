import { useEffect, useState, type ReactNode } from 'react'
import { ActingContext, readActing, writeActing } from './actingContext'
import type { LocalCampaignRecord } from './types'
import { useLocalCatalog } from './useLocalCampaign'

export function ActingProvider({ campaign, children }: { campaign: LocalCampaignRecord; children: ReactNode }) {
  const [masterId, setMasterIdState] = useState(() => readActing(campaign))
  useEffect(() => { setMasterIdState(readActing(campaign)) }, [campaign.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const setMasterId = (id: string) => { setMasterIdState(id); writeActing(campaign.id, id) }
  // In a shared campaign the master is whoever signed in; there is nothing to pick.
  const { shared } = useLocalCatalog()
  const signedIn = shared?.isShared(campaign.id) ? campaign.masters.find((master) => master.email === shared.email) : undefined
  return <ActingContext.Provider value={signedIn ? { masterId: signedIn.id, setMasterId: () => undefined, locked: true } : { masterId, setMasterId }}>{children}</ActingContext.Provider>
}
