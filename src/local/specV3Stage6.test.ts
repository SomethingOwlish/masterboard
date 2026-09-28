import { describe, expect, it } from 'vitest'
import { MemoryStorageGateway } from '../adapters/memoryStorageGateway'
import { documentTitle } from '../components/useDocumentTitle'
import { blankCampaign, createLocalCampaignCatalog } from './catalog'
import { ENTITY_LABEL, IDEA_PLACEHOLDER, RELATION_TYPE, TIME_PLACEHOLDER, VISIBILITY_LABEL } from './labels'
import { blankSession, normalizeCampaign } from './normalize'
import { TIMELINE_DEFAULT, filterTimeline, timeline } from './plan'
import { MasterboardApi, createSharedCatalog } from './remote'
import { nameFromEmail, parseMasters } from './team'
import type { LocalSessionPlanItem, LocalSessionRecord } from './types'

/** A Worker stand-in that stores what is put and returns it as the saved version. */
function echoWorker() {
  const saved: Array<Record<string, unknown>> = []
  const fetcher = (async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const { data } = JSON.parse(String(init.body)) as { data: Record<string, unknown> }
      saved.push(data)
      return new Response(JSON.stringify({ path: String(url), data, revision: 1 }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response('null', { status: 404, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
  return { saved, api: new MasterboardApi(fetcher) }
}

const item = (id: string, kind: LocalSessionPlanItem['kind'], patch: Partial<LocalSessionPlanItem> = {}): LocalSessionPlanItem =>
  ({ id, source: 'text', text: id, kind, priority: 'desired', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared', ...patch })

describe('ТЗ-3, этап 6: глоссарий и тексты', () => {
  it('keeps one word per notion in the label maps', () => {
    expect(VISIBILITY_LABEL).toEqual({ master: 'Только мастерам', public: 'Для игроков' })
    expect(ENTITY_LABEL.npc).toBe('NPC')
    expect(RELATION_TYPE.other).toBe('Другое')
  })

  it('creates a campaign without placeholders in its data', () => {
    const campaign = blankCampaign('Порт', '  ', '2026-09-28T10:00:00.000Z')
    expect(campaign.idea).toBe('')
    expect(campaign.activeTime).toBe('')
    expect(campaign.masters[0].name).not.toBe('Ведущий')
  })

  it('names the first master of a new shared campaign after the part of the email before «@»', async () => {
    const { saved, api } = echoWorker()
    const catalog = createSharedCatalog(createLocalCampaignCatalog(new MemoryStorageGateway(), { seed: false }), api, 'owl.night@example.com')
    const campaign = await catalog.create('Лунный порт', '')
    expect(campaign.masters).toEqual([expect.objectContaining({ name: 'owl.night', role: 'owner', email: 'owl.night@example.com' })])
    expect(saved[0]).toMatchObject({ idea: '', activeTime: '' })
    expect(nameFromEmail('@example.com')).toBe('Мастер')
    expect(parseMasters('')[0].name).toBe('Мастер')
  })

  it('clears placeholders that older versions stored as data', () => {
    const stored = normalizeCampaign({ id: 'c', name: 'К', idea: IDEA_PLACEHOLDER, activeTime: TIME_PLACEHOLDER }, '2026-09-28T10:00:00.000Z')!
    expect(stored.idea).toBe('')
    expect(stored.activeTime).toBe('')
    const real = normalizeCampaign({ id: 'c', name: 'К', idea: 'Сделки с луной', activeTime: 'Третья ночь' }, '2026-09-28T10:00:00.000Z')!
    expect(real.idea).toBe('Сделки с луной')
    expect(real.activeTime).toBe('Третья ночь')
  })

  it('shows scenes, events, goals and consequences on the timeline by default', () => {
    const session: LocalSessionRecord = {
      ...blankSession(1, 'master', '2026-09-28T10:00:00.000Z'),
      planItems: [item('scene', 'scene'), item('event', 'event'), item('goal', 'goal'), item('consequence', 'consequence'), item('npc', 'npc'), item('note', 'note'), item('skipped', 'event', { status: 'skipped' })],
    }
    const shown = filterTimeline(timeline(session), TIMELINE_DEFAULT).flatMap((step) => step.kind === 'single' ? [step.item.id] : [])
    expect(shown).toEqual(['scene', 'event', 'goal', 'consequence'])
  })

  it('titles the tab from the section to the app', () => {
    expect(documentTitle('Библиотека', 'Порт')).toBe('Библиотека · Порт · Мастерборд')
    expect(documentTitle('Кампании')).toBe('Кампании · Мастерборд')
    expect(documentTitle(undefined, 'Порт')).toBe('Порт · Мастерборд')
  })
})
