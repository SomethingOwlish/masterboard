import { describe, expect, it } from 'vitest'
import { CampaignContentRepository, type CampaignContentDocument } from '../storage/campaignContentRepository'
import { CampaignRepository } from '../storage/campaignRepository'
import { createDemoWorkspace, DEMO_IDS, demoWorkspaceSeed } from './demoWorkspace'

interface EntityDocument extends CampaignContentDocument {
  entityType: string
  name: string
  tags: string[]
  archived: boolean
}

describe('demo workspace fixture', () => {
  it('is deterministic and contains no production-looking credentials', () => {
    expect(demoWorkspaceSeed()).toEqual(demoWorkspaceSeed())
    expect(JSON.stringify(demoWorkspaceSeed())).not.toMatch(/token|password|secretKey|apiKey/i)
    expect(JSON.stringify(demoWorkspaceSeed())).toContain('@example.test')
  })

  it('opens the same campaign for owner and co-master', async () => {
    for (const masterId of [DEMO_IDS.owner, DEMO_IDS.coMaster]) {
      const workspace = createDemoWorkspace(masterId)
      const campaigns = new CampaignRepository(workspace.storage)
      expect((await campaigns.listForMaster(masterId)).map((campaign) => campaign.path)).toEqual([
        `campaigns/${DEMO_IDS.campaign}`,
      ])
    }
  })

  it('provides a story-coherent entity library for UI tests', async () => {
    const workspace = createDemoWorkspace()
    const entities = new CampaignContentRepository<EntityDocument>(workspace.storage, 'entities')
    const library = await entities.list(workspace.campaignId, workspace.activeMasterId)
    expect(library.map((entry) => entry.data.name)).toEqual([
      'Bryn Vale', 'Lantern Guild', 'Moon Port', 'The Red Moon Collects Debts', 'The Silver Fox',
    ])
    expect(library.map((entry) => entry.data.entityType)).toEqual([
      'character', 'faction', 'location', 'rumor', 'npc',
    ])
  })

  it('creates isolated copies for tests', async () => {
    const first = createDemoWorkspace()
    const second = createDemoWorkspace()
    await first.storage.patch(`campaigns/${DEMO_IDS.campaign}`, { name: 'Changed in first test' })
    expect((await second.storage.get(`campaigns/${DEMO_IDS.campaign}`))?.data.name).toBe('Moon Port')
  })

  it('includes local fake projections and a draft publication without an adapter', async () => {
    const workspace = createDemoWorkspace()
    expect(await workspace.storage.list(`campaigns/${DEMO_IDS.campaign}/connections`)).toHaveLength(1)
    expect(await workspace.storage.list(`campaigns/${DEMO_IDS.campaign}/projections`)).toHaveLength(1)
    const queue = await workspace.storage.list(`campaigns/${DEMO_IDS.campaign}/publicationQueue`)
    expect(queue).toHaveLength(3)
    expect(queue.map((item) => item.data.operation)).toEqual(['change-name', 'change-status', 'create'])
    expect(queue.every((item) => item.data.state === 'draft')).toBe(true)
  })

  it('rejects an outsider as the active demo master', () => {
    expect(() => createDemoWorkspace('outsider')).toThrow('Demo master must be the owner or co-master')
  })
})
