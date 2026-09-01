import { describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { CampaignPermissionError, CampaignRepository } from './campaignRepository'

const CREATED = '2026-09-01T14:00:00.000Z'

function repository() {
  return new CampaignRepository(new MemoryStorageGateway())
}

describe('CampaignRepository', () => {
  it('creates the minimum target campaign document', async () => {
    const repo = repository()
    const campaign = await repo.create({
      id: 'camp-1', name: '  Night City  ', idea: '  Neon intrigue  ', mode: 'single-group',
      ownerId: 'master-owner', now: CREATED,
    })
    expect(campaign.data).toEqual({
      name: 'Night City', idea: 'Neon intrigue', mode: 'single-group', ownerId: 'master-owner',
      coMasterId: undefined, createdAt: CREATED, updatedAt: CREATED,
    })
  })

  it('gives owner and co-master equal access to campaign details', async () => {
    const repo = repository()
    await repo.create({
      id: 'camp-1', name: 'Night City', mode: 'groups', ownerId: 'master-owner',
      coMasterId: 'master-co', now: CREATED,
    })
    await repo.updateDetails('camp-1', 'master-co', { idea: 'Shared plan' }, '2026-09-01T14:01:00.000Z')
    expect((await repo.getForMaster('camp-1', 'master-owner'))?.data.idea).toBe('Shared plan')
    expect((await repo.getForMaster('camp-1', 'master-co'))?.data.idea).toBe('Shared plan')
    await expect(repo.getForMaster('camp-1', 'master-other')).rejects.toBeInstanceOf(CampaignPermissionError)
  })

  it('lists only campaigns available to the selected master', async () => {
    const repo = repository()
    await repo.create({ id: 'owned', name: 'Owned', mode: 'single-group', ownerId: 'master-1', now: CREATED })
    await repo.create({
      id: 'shared', name: 'Shared', mode: 'groups', ownerId: 'master-2', coMasterId: 'master-1', now: CREATED,
    })
    await repo.create({ id: 'private', name: 'Private', mode: 'single-group', ownerId: 'master-3', now: CREATED })
    expect((await repo.listForMaster('master-1')).map((campaign) => campaign.path)).toEqual([
      'campaigns/owned', 'campaigns/shared',
    ])
  })

  it('allows only the owner to replace the co-master', async () => {
    const repo = repository()
    await repo.create({
      id: 'camp-1', name: 'Night City', mode: 'groups', ownerId: 'master-owner',
      coMasterId: 'master-old', now: CREATED,
    })
    await expect(repo.replaceCoMaster('camp-1', 'master-old', 'master-new', CREATED))
      .rejects.toBeInstanceOf(CampaignPermissionError)
    const updated = await repo.replaceCoMaster('camp-1', 'master-owner', 'master-new', CREATED)
    expect(updated.data.coMasterId).toBe('master-new')
  })
})
