import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { ExternalGateway } from '../adapters/fakeExternal'
import type { CapabilityPassport, ExternalConnection } from '../model/external'
import { ExternalError, HttpExternalGateway } from './external'
import { ROLE_OF, importType, linkedRole, roleConnection, type BaseOption, type CampaignRole, type ExternalItem, type ExternalListing, type ExternalSchema } from './integration'
import type { LocalCampaignEntityType, LocalCampaignRecord } from './types'
import type { BackupStatus } from './backup'
import type { Kk9SessionBody, Kk9SessionResult, Kk9State } from './kk9'
import type { NocturneSessionBody, NocturneSessionResult, NocturneState } from './nocturne'

/** What the screens need from lorebook / lovegame / systemsetup / kk9 / nocturne. */
export interface ExternalPort extends ExternalGateway {
  entities(connectionId: string, type?: string): Promise<ExternalItem[]>
  listing(connectionId: string, type?: string): Promise<ExternalListing>
  /** Optional: a port without it has no schema (ТЗ-2, R2). */
  schema?(connectionId: string): Promise<ExternalSchema>
  kk9State(externalId: string): Promise<Kk9State>
  sendKk9Session(externalId: string, sessionId: string, body: Kk9SessionBody): Promise<Kk9SessionResult>
  nocturneState(externalId: string): Promise<NocturneState>
  sendNocturneSession(externalId: string, sessionId: string, body: NocturneSessionBody): Promise<NocturneSessionResult>
  /** Итог последней резервной копии (М5). */
  backupStatus(): Promise<BackupStatus>
  /** Резервная копия сейчас; отвечает тем же итогом. */
  backupNow(): Promise<BackupStatus>
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

export type BaseOptionsState =
  | { status: 'loading' }
  | { status: 'ready'; options: Record<CampaignRole, BaseOption[]> }
  | { status: 'unconfigured' | 'error'; message: string }

/**
 * Everything the master can base a campaign on, by role. Worlds and tables are
 * connections; SystemSetup systems are records inside its `packs` connection.
 */
export function useBaseOptions(): BaseOptionsState {
  const port = useExternal()
  const connections = useConnections()
  const [systems, setSystems] = useState<BaseOption[] | null>(null)
  useEffect(() => {
    if (connections.status !== 'ready') return
    let alive = true
    const packs = connections.connections.filter((item) => item.system === 'systemsetup')
    Promise.all(packs.map((pack) => port.entities(pack.id).then((items) => items.filter((item) => !item.archived).map((item): BaseOption => ({ system: 'systemsetup', externalId: item.id, label: item.name, url: item.url, connectionId: pack.externalId })), () => [] as BaseOption[])))
      .then((lists) => { if (alive) setSystems(lists.flat()) })
    return () => { alive = false }
  }, [port, connections])
  if (connections.status !== 'ready') return connections
  if (!systems) return { status: 'loading' }
  const of = (role: CampaignRole) => connections.connections.filter((item) => ROLE_OF[item.system] === role && item.system !== 'systemsetup').map((item): BaseOption => ({ system: item.system, externalId: item.externalId, label: item.label, url: item.url }))
  return { status: 'ready', options: { world: of('world'), table: of('table'), system: systems } }
}

/** Fields the linked world, table and system declare for a type (ТЗ-2, R2), read once per screen. */
export function useBaseSchema(campaign: Pick<LocalCampaignRecord, 'integrations'>, type: LocalCampaignEntityType): Array<{ label: string; long?: boolean; from: string }> {
  const port = useExternal()
  const connections = (['world', 'table', 'system'] as CampaignRole[]).flatMap((role) => { const linked = linkedRole(campaign, role); return linked ? [{ id: roleConnection(linked.system, linked.link), system: linked.system }] : [] })
  const key = connections.map((item) => item.id).join('|')
  const [schemas, setSchemas] = useState<Record<string, ExternalSchema>>({})
  useEffect(() => {
    if (!port.schema || !key) return
    let alive = true
    for (const connection of connections) port.schema(connection.id).then((schema) => { if (alive) setSchemas((current) => ({ ...current, [connection.id]: schema })) }, () => undefined)
    return () => { alive = false }
  }, [port, key]) // eslint-disable-line react-hooks/exhaustive-deps
  return connections.flatMap((connection) => (schemas[connection.id] ?? []).filter((entry) => importType(connection.system, entry.type) === type).flatMap((entry) => entry.fields.map((field) => ({ ...field, from: connection.system }))))
}
