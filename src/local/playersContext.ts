import { createContext, useContext } from 'react'
import { HttpPlayersGateway, type PlayersGateway } from './players'

export const PlayersContext = createContext<PlayersGateway | null>(null)
let fallback: PlayersGateway | null = null

/** The directory gateway: the one a provider gives (tests), else the Worker's. */
export function usePlayersGateway(): PlayersGateway {
  const gateway = useContext(PlayersContext)
  if (gateway) return gateway
  fallback ??= new HttpPlayersGateway()
  return fallback
}
