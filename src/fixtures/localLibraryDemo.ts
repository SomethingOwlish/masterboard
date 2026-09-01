import { EntityLibrary, type EntityLibraryFilter, type ManualEntityInput } from '../storage/entityLibrary'
import { createDemoWorkspace, type DemoWorkspace } from './demoWorkspace'

export function createLocalLibraryDemo(workspace: DemoWorkspace = createDemoWorkspace()) {
  const library = new EntityLibrary(workspace.storage)
  return {
    ...workspace,
    load: (filter: EntityLibraryFilter = {}) => library.list(workspace.campaignId, workspace.activeMasterId, filter),
    create: (input: Omit<ManualEntityInput, 'id'>) => library.createManual(
      workspace.campaignId,
      workspace.activeMasterId,
      { ...input, id: `entity-${crypto.randomUUID()}` },
      new Date().toISOString(),
    ),
    setArchived: (ids: string[], archived: boolean) => library.setArchived(
      workspace.campaignId, workspace.activeMasterId, ids, archived, new Date().toISOString(),
    ),
  }
}

