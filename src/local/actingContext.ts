import { createContext, useContext } from 'react'
import { canManageCampaign, canRunSession, ownerOf } from './team'
import type { LocalCampaignRecord, LocalMaster, LocalSessionRecord } from './types'

export interface ActingState { masterId: string; setMasterId: (id: string) => void }
export const ActingContext = createContext<ActingState | null>(null)

const storageKey = (campaignId: string) => `masterboard.acting-master.${campaignId}`

/** Which master works in this browser; a per-viewer convenience, so localStorage is enough. */
export function readActing(campaign: LocalCampaignRecord): string {
  let stored: string | null = null
  try { stored = window.localStorage.getItem(storageKey(campaign.id)) } catch { stored = null }
  return campaign.masters.some((master) => master.id === stored) ? stored as string : ownerOf(campaign).id
}

export function writeActing(campaignId: string, masterId: string) {
  try { window.localStorage.setItem(storageKey(campaignId), masterId) } catch { /* private mode: keep in memory only */ }
}

export interface Acting {
  master: LocalMaster
  setMasterId: (id: string) => void
  /** Owner-only: masters, ownership, archive, deletion. */
  canManage: boolean
  canRun: (session: LocalSessionRecord) => boolean
}

export function useActing(campaign: LocalCampaignRecord): Acting {
  const state = useContext(ActingContext)
  const masterId = state && campaign.masters.some((master) => master.id === state.masterId) ? state.masterId : ownerOf(campaign).id
  const master = campaign.masters.find((item) => item.id === masterId) ?? ownerOf(campaign)
  return {
    master,
    setMasterId: state?.setMasterId ?? (() => undefined),
    canManage: canManageCampaign(campaign, master.id),
    canRun: (session) => canRunSession(campaign, session, master.id),
  }
}
