import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import type { DocumentData } from '../storage/gateway'

export const DEMO_IDS = {
  owner: 'master-owl',
  coMaster: 'master-fox',
  campaign: 'campaign-moon-port',
  player: 'player-alex',
  character: 'entity-bryn',
  npc: 'entity-silver-fox',
  location: 'entity-moon-port',
  faction: 'entity-lantern-guild',
  rumor: 'entity-red-moon-rumor',
  session: 'session-opening-night',
} as const

export interface DemoWorkspace {
  storage: MemoryStorageGateway
  activeMasterId: string
  campaignId: string
}

const CREATED = '2026-08-30T18:00:00.000Z'
const UPDATED = '2026-09-01T12:00:00.000Z'

function campaignPath(collection: string, id: string): string {
  return `campaigns/${DEMO_IDS.campaign}/${collection}/${id}`
}

/**
 * A deterministic, story-coherent workspace used by UI, integration and manual
 * tests. It contains no credentials and never performs network I/O.
 */
export function demoWorkspaceSeed(): Record<string, DocumentData> {
  return {
    [`masters/${DEMO_IDS.owner}`]: {
      email: 'owl@example.test', displayName: 'Owl', createdAt: CREATED, updatedAt: UPDATED,
    },
    [`masters/${DEMO_IDS.coMaster}`]: {
      email: 'fox@example.test', displayName: 'Fox', createdAt: CREATED, updatedAt: UPDATED,
    },
    [`players/${DEMO_IDS.player}`]: {
      name: 'Alex', preferences: 'Investigation and social scenes', style: 'Methodical',
      schedule: 'Friday evenings', triggers: 'Discuss before horror themes', notes: '',
      createdAt: CREATED, updatedAt: UPDATED,
    },
    [`campaigns/${DEMO_IDS.campaign}`]: {
      name: 'Moon Port', idea: 'A harbor city bargains with a red moon.', mode: 'single-group',
      ownerId: DEMO_IDS.owner, coMasterId: DEMO_IDS.coMaster,
      activeTime: 'Third night of the Lantern Festival', createdAt: CREATED, updatedAt: UPDATED,
    },
    [campaignPath('entities', DEMO_IDS.character)]: {
      entityType: 'character', name: 'Bryn Vale', status: 'active', playerId: DEMO_IDS.player,
      concept: 'Harbor cartographer who sees impossible coastlines', tags: ['party', 'cartographer'],
      archived: false, createdAt: CREATED, updatedAt: UPDATED,
    },
    [campaignPath('entities', DEMO_IDS.npc)]: {
      entityType: 'npc', name: 'The Silver Fox', status: 'active', currentState: 'Watching the eastern gate',
      roles: ['informant', 'rival'], tags: ['guild', 'secret-keeper'], archived: false,
      masterNote: 'Knows why the moon changed color.', publicDraft: 'A charming smuggler.',
      createdAt: CREATED, updatedAt: UPDATED,
    },
    [campaignPath('entities', DEMO_IDS.location)]: {
      entityType: 'location', name: 'Moon Port', status: 'exists',
      description: 'Tidal stairs, brass lanterns, and a harbor that moves at midnight.',
      tags: ['harbor', 'city'], archived: false, createdAt: CREATED, updatedAt: UPDATED,
    },
    [campaignPath('entities', DEMO_IDS.faction)]: {
      entityType: 'faction', name: 'Lantern Guild', status: 'active',
      goals: ['Control the eastern gate', 'Hide the old tide charts'], tags: ['guild'],
      archived: false, createdAt: CREATED, updatedAt: UPDATED,
    },
    [campaignPath('entities', DEMO_IDS.rumor)]: {
      entityType: 'rumor', name: 'The Red Moon Collects Debts', truth: 'partial-truth',
      text: 'Every red tide takes one promise from the city.', tags: ['moon', 'festival'],
      audiences: [
        { audienceId: DEMO_IDS.faction, state: 'heard' },
        { freeText: 'Dock workers', state: 'spreading' },
      ],
      archived: false, createdAt: CREATED, updatedAt: UPDATED,
    },
    [campaignPath('relations', 'relation-fox-guild')]: {
      sideAId: DEMO_IDS.npc, sideBId: DEMO_IDS.faction, direction: 'a-to-b', type: 'owes a debt',
      state: 'current', hiddenFromPlayers: true, tags: ['debt'],
      masterTruth: 'The debt was manufactured.', publicVersion: 'A failed smuggling run.',
      createdAt: CREATED, updatedAt: UPDATED,
    },
    [campaignPath('lines', 'line-red-tide')]: {
      title: 'The red tide', direction: 'Discover who moves the harbor', stakes: 'The city loses its shoreline',
      ownerId: 'plot', state: 'active', tags: ['main'], createdAt: CREATED, updatedAt: UPDATED,
    },
    [campaignPath('events', 'event-gate-opens')]: {
      title: 'The eastern gate opens', plannedDescription: 'The Fox offers a map.',
      plannedTime: 'Festival night 3, midnight', factualDescription: '', groupStates: [
        { groupId: 'group-party', role: 'main', knowledge: 'unknown' },
      ],
      createdAt: CREATED, updatedAt: UPDATED,
    },
    [campaignPath('secrets', 'secret-moving-harbor')]: {
      title: 'The harbor is a sleeping creature', truth: 'The city is built on its shell.',
      state: 'hidden', knownByEntityIds: [DEMO_IDS.npc], revealConditions: ['Read the oldest tide chart'],
      createdAt: CREATED, updatedAt: UPDATED,
    },
    [campaignPath('tasks', 'task-prepare-map')]: {
      title: 'Prepare the eastern gate map', state: 'doing', tags: ['next-session'], order: 10,
      createdAt: CREATED, updatedAt: UPDATED,
    },
    [campaignPath('tasks', 'task-name-captain')]: {
      title: 'Name the night-watch captain', state: 'todo', tags: ['inbox'], order: 20,
      createdAt: CREATED, updatedAt: UPDATED,
    },
    [campaignPath('materials', 'material-gate-map')]: {
      title: 'Eastern Gate map', kind: 'map', urls: ['https://example.test/eastern-gate-map'],
      mainImageIndex: 0, sessionIds: [DEMO_IDS.session], createdAt: CREATED, updatedAt: UPDATED,
    },
    [campaignPath('connections', 'connection-lovegame-fake')]: {
      system: 'lovegame', scope: 'campaign', externalId: 'fake-lovegame-campaign',
      label: 'Fake Lovegame campaign', state: 'active', createdAt: CREATED, updatedAt: UPDATED,
    },
    [campaignPath('projections', 'projection-fox-lovegame')]: {
      entityId: DEMO_IDS.npc, connectionId: 'connection-lovegame-fake', externalId: 'fake-npc-fox',
      externalType: 'npc', visibility: 'masters-only', syncState: 'local-changes', mapping: [],
      createdAt: CREATED, updatedAt: UPDATED,
    },
    [campaignPath('publicationQueue', 'publication-fox-name')]: {
      entityId: DEMO_IDS.npc, entityType: 'npc', connectionId: 'connection-lovegame-fake',
      projectionId: 'projection-fox-lovegame', operation: 'change-name',
      patch: { name: 'The Silver Fox' }, state: 'draft', createdAt: UPDATED, updatedAt: UPDATED,
    },
  }
}

export function createDemoWorkspace(activeMasterId: string = DEMO_IDS.owner): DemoWorkspace {
  if (activeMasterId !== DEMO_IDS.owner && activeMasterId !== DEMO_IDS.coMaster) {
    throw new Error('Demo master must be the owner or co-master')
  }
  return {
    storage: new MemoryStorageGateway(demoWorkspaceSeed()),
    activeMasterId,
    campaignId: DEMO_IDS.campaign,
  }
}
