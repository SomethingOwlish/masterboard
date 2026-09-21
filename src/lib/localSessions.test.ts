import { describe, expect, it } from 'vitest'
import { createLocalCampaignCatalog } from '../fixtures/localCampaignCatalog'
import { createLocalSession, deleteLocalSession, duplicateLocalSession, restoreLocalSession, selectLocalSession, selectedSessionNumber, sessionPath, startLocalSession, syncLocalSessions, validSessionDocuments } from './localSessions'

function setup() {
  const data = new Map<string, string>()
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
  const catalog = createLocalCampaignCatalog(storage)
  return { catalog, campaign: catalog.create('Campaign', '') }
}

describe('independent session documents', () => {
  it('migrates legacy current and archive once without losing layouts or logs', () => {
    const { campaign } = setup()
    const legacy = { ...campaign, firstSessionTitle: 'Current', firstSessionScenes: [{ id: 's', title: 'Gate', purpose: '', position: { x: 90, y: 50 } }], sessionHistory: [{ id: 'old', seq: 1, title: 'Past', objective: '', opening: '', scenes: [], log: [{ id: 'log', text: 'Done', createdAt: '2026-09-20' }], completedAt: '2026-09-20' }] }
    const migrated = syncLocalSessions(legacy)
    expect(migrated.sessionDocuments).toHaveLength(2)
    expect(migrated.sessionDocuments?.[0].log[0].text).toBe('Done')
    expect(migrated.sessionDocuments?.[1].scenes[0].position).toEqual({ x: 90, y: 50 })
    expect(syncLocalSessions(migrated)).toEqual(migrated)
    expect(syncLocalSessions(legacy).selectedSessionId).toBe(migrated.selectedSessionId)
  })
  it('keeps future plans independent through saves, switching, reload and backup', () => {
    const { catalog, campaign } = setup()
    let current = catalog.update(createLocalSession(campaign, 'First', '2026-10-01'))
    const first = current.selectedSessionId!
    current = catalog.update({ ...current, firstSessionScenes: [{ id: 'a', title: 'Gate', purpose: '' }], firstSessionRecap: 'Notes' })
    current = catalog.update(createLocalSession(current, 'Second', '2026-10-08'))
    const second = current.selectedSessionId!
    current = catalog.update({ ...current, firstSessionScenes: [{ id: 'b', title: 'Port', purpose: '' }] })
    const reloaded = catalog.find(current.id)!
    expect(selectLocalSession(reloaded, first)).toMatchObject({ firstSessionTitle: 'First', firstSessionDate: '2026-10-01', firstSessionRecap: 'Notes', firstSessionScenes: [{ id: 'a' }] })
    expect(selectLocalSession(reloaded, second).firstSessionScenes[0].id).toBe('b')
    catalog.importBackup(catalog.exportBackup())
    expect(catalog.load().campaigns[1].sessionDocuments).toEqual(reloaded.sessionDocuments)
    expect(sessionPath(selectLocalSession(reloaded, first), 'print')).toContain(encodeURIComponent(first))
  })
  it('duplicates geometry and remaps scene arrows while clearing play history', () => {
    const { campaign } = setup()
    let current = createLocalSession(campaign, 'Original')
    current = { ...current, firstSessionStatus: 'completed', firstSessionRecap: 'Done', firstSessionLog: [{ id: 'log', text: 'Done', createdAt: '2026-09-20' }], firstSessionScenes: [{ id: 'a', title: 'A', purpose: '', memberIds: ['npc'], position: { x: 7, y: 9 }, nextSceneIds: ['b'] }, { id: 'b', title: 'B', purpose: '' }] }
    const copy = duplicateLocalSession(current, current.selectedSessionId!)
    expect(copy.firstSessionScenes[0]).toMatchObject({ memberIds: ['npc'], position: { x: 7, y: 9 }, nextSceneIds: [copy.firstSessionScenes[1].id] })
    expect(copy.firstSessionScenes[0].id).not.toBe('a')
    expect(copy).toMatchObject({ firstSessionStatus: 'draft', firstSessionLog: [], firstSessionRecap: '', firstSessionDate: '' })
  })
  it('restores the last deleted session and never reuses sequence numbers', () => {
    const { campaign } = setup()
    const first = createLocalSession(campaign, 'First')
    const deleted = deleteLocalSession(first, first.selectedSessionId!)
    expect(deleted.firstSessionTitle).toBe('')
    expect(deleted.sessions).toBe(0)
    const second = createLocalSession(deleted, 'Second')
    expect(selectedSessionNumber(second)).toBe(2)
    const restored = restoreLocalSession(second, first.selectedSessionId!)
    expect(restored.firstSessionTitle).toBe('First')
    expect(restored.sessions).toBe(2)
    expect(selectedSessionNumber(restored)).toBe(1)
  })
  it('allows preparation during play but prevents two simultaneous games or deleting an active game', () => {
    const { campaign } = setup()
    const first = createLocalSession(campaign, 'First')
    const active = startLocalSession({ ...first, firstSessionStatus: 'ready' })
    expect(() => deleteLocalSession(active, active.selectedSessionId!)).toThrow('завершите')
    const second = createLocalSession(active, 'Second')
    expect(() => startLocalSession({ ...second, firstSessionStatus: 'ready' })).toThrow('уже идёт')
    const finished = { ...selectLocalSession(second, active.selectedSessionId!), firstSessionStatus: 'completed' as const }
    expect(startLocalSession({ ...selectLocalSession(finished, second.selectedSessionId!), firstSessionStatus: 'ready' }).firstSessionStatus).toBe('active')
  })
  it('rejects impossible dates and malformed document backups without changing storage', () => {
    const { catalog, campaign } = setup()
    expect(() => createLocalSession(campaign, 'Invalid', '2026-02-30')).toThrow()
    const current = catalog.update(createLocalSession(campaign, 'Valid', '2028-02-29'))
    expect(validSessionDocuments([null])).toBe(false)
    expect(validSessionDocuments([...current.sessionDocuments!, ...current.sessionDocuments!])).toBe(false)
    const before = catalog.exportRaw()
    expect(() => catalog.importBackup(JSON.stringify({ format: 'masterboard-backup/v1', campaigns: [{ ...current, sessionDocuments: [{ ...current.sessionDocuments![0], scenes: [null] }] }] }))).toThrow()
    expect(catalog.exportRaw()).toBe(before)
  })
})
