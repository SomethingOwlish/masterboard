import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { ExternalGateway } from '../adapters/fakeExternal'
import type { CapabilityPassport, ExternalConnection } from '../model/external'
import { ExternalError, HttpExternalGateway } from './external'
import type { ExternalItem } from './integration'

/** What the screens need from lorebook / lovegame / systemsetup. */
export interface ExternalPort extends ExternalGateway {
  entities(connectionId: string, type?: string): Promise<ExternalItem[]>
}

let defaultPort: ExternalPort | null = null
const ExternalContext = createContext<ExternalPort | null>(null)

export function ExternalProvider({ port, children }: { port: ExternalPort; children: ReactNode }) {
  return <ExternalContext.Provider value={port}>{children}</ExternalContext.Provider>
}

export function useExternal(): ExternalPort {
  const port = useContext(ExternalContext)
  if (port) return port
  defaultPort ??= new HttpExternalGateway()
  return defaultPort
}

export type ConnectionsState =
  | { status: 'loading' }
  | { status: 'ready'; connections: ExternalConnection[] }
  | { status: 'unconfigured' | 'error'; message: string }

/** The worlds / campaigns / systems this master can reach, read once per screen. */
export function useConnections(): ConnectionsState {
  const port = useExternal()
  const [state, setState] = useState<ConnectionsState>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    port.listConnections().then(
      (connections) => { if (alive) setState({ status: 'ready', connections }) },
      (error: unknown) => { if (alive) setState({ status: error instanceof ExternalError && error.unconfigured ? 'unconfigured' : 'error', message: error instanceof Error ? error.message : 'Не удалось получить подключения' }) },
    )
    return () => { alive = false }
  }, [port])
  return state
}

/** Capability passports by connection, fetched on demand and kept for the screen's life. */
export function usePassports(connectionIds: string[]): Record<string, CapabilityPassport | undefined> {
  const port = useExternal()
  const [passports, setPassports] = useState<Record<string, CapabilityPassport | undefined>>({})
  const wanted = [...new Set(connectionIds)].filter((id) => !(id in passports)).sort().join('|')
  useEffect(() => {
    if (!wanted) return
    for (const id of wanted.split('|')) {
      setPassports((current) => ({ ...current, [id]: undefined }))
      // A late answer is still worth keeping: the key is already marked as requested.
      port.getPassport(id).then((passport) => setPassports((current) => ({ ...current, [id]: passport })), () => undefined)
    }
  }, [port, wanted])
  return passports
}
