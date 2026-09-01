import type {
  CapabilityPassport,
  ExternalConnection,
  PublicationQueueItem,
} from '../model/external'

export interface ExternalGateway {
  listConnections(): Promise<ExternalConnection[]>
  getPassport(connectionId: string): Promise<CapabilityPassport>
  publish(item: PublicationQueueItem): Promise<PublicationQueueItem>
}

/** Deterministic test/manual-development adapter. It never performs network I/O. */
export class FakeExternalGateway implements ExternalGateway {
  readonly published: PublicationQueueItem[] = []

  constructor(
    private readonly connections: ExternalConnection[],
    private readonly passports: CapabilityPassport[],
  ) {}

  async listConnections(): Promise<ExternalConnection[]> {
    return structuredClone(this.connections)
  }

  async getPassport(connectionId: string): Promise<CapabilityPassport> {
    const passport = this.passports.find((candidate) => candidate.connectionId === connectionId)
    if (!passport) throw new Error(`No fake passport for connection ${connectionId}`)
    return structuredClone(passport)
  }

  async publish(item: PublicationQueueItem): Promise<PublicationQueueItem> {
    if (item.state !== 'ready') throw new Error('Only a confirmed ready item can be published')
    const completed = { ...item, state: 'succeeded' as const, completedAt: item.confirmedAt ?? item.createdAt }
    this.published.push(structuredClone(completed))
    return completed
  }
}
