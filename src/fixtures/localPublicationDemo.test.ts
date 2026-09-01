import { describe, expect, it } from 'vitest'
import { DEMO_IDS } from './demoWorkspace'
import { createLocalPublicationDemo } from './localPublicationDemo'

describe('local publication demo runtime', () => {
  it('demonstrates ready, blocked, succeeded, and failed states without network I/O', async () => {
    const demo = createLocalPublicationDemo()
    const preview = await demo.preview()
    expect(preview.counts).toMatchObject({ ready: 2, blocked: 1 })
    await demo.confirm([DEMO_IDS.publicationRename, DEMO_IDS.publicationFailure])
    const result = await demo.execute()
    expect(result.history.map((item) => item.id)).toEqual([DEMO_IDS.publicationRename])
    expect(result.active.find((item) => item.id === DEMO_IDS.publicationFailure)?.state).toBe('failed')
    expect(demo.gateway.published).toHaveLength(1)
  })
})

