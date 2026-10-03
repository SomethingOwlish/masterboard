// Ноктюрн глазами Masterboard (решения 3 октября 2026): типы, связи, посты итогов и вид стола.
import { describe, expect, it } from 'vitest'
import type { CapabilityOperation, CapabilityPassport } from '../model/external'
import { blankCampaign } from './catalog'
import { newEntity } from './domain'
import { importItems, importType, LINKABLE_SYSTEMS, ROLE_OF, SYSTEM_LABEL, targetTypes, withLink, WRITABLE_SYSTEMS, type ExternalItem } from './integration'
import { blankSession } from './normalize'
import { nocturneDateText, nocturneNextSession, nocturnePosts, type NocturneState } from './nocturne'
import { liveTable, nocturneView, notableDistrict, trackText } from './table'

const item = (patch: Partial<ExternalItem> & Pick<ExternalItem, 'id' | 'type' | 'name'>): ExternalItem => ({ summary: '', tags: [], fields: {}, visibility: 'master', archived: false, updatedAt: 1, ...patch })

describe('Ноктюрн как стол', () => {
  it('связывается как стол, пишется, у него своё имя', () => {
    expect(LINKABLE_SYSTEMS).toContain('nocturne')
    expect(WRITABLE_SYSTEMS).toContain('nocturne')
    expect(ROLE_OF.nocturne).toBe('table')
    expect(SYSTEM_LABEL.nocturne).toBe('Ноктюрн')
  })

  it('стол один: Ноктюрн вытесняет КК9, и живой стол — Ноктюрн', () => {
    let campaign = blankCampaign('Детройт', '', '2026-10-03T00:00:00.000Z')
    campaign = withLink(campaign, 'kk9', { externalId: 'k1', label: 'Академия' })
    campaign = withLink(campaign, 'nocturne', { externalId: 'c1', label: 'Детройт' })
    expect(campaign.integrations.kk9).toBeUndefined()
    expect(liveTable(campaign)).toEqual({ system: 'nocturne', link: { externalId: 'c1', label: 'Детройт' } })
  })

  it('виды кодекса ложатся своими типами, Столп — НПС (04-A)', () => {
    expect(importType('nocturne', 'character')).toBe('character')
    expect(importType('nocturne', 'touchstone')).toBe('npc')
    expect(importType('nocturne', 'location')).toBe('location')
    expect(importType('nocturne', 'event')).toBe('event')
  })

  it('широкая таблица: у всего есть вид, без пары — лор', () => {
    const rw: CapabilityOperation[] = ['read', 'create', 'update', 'change-visibility']
    const passport: CapabilityPassport = { connectionId: 'nocturne:c1', fetchedAt: '', entities: [
      { entityType: 'character', label: 'Персонаж', enabled: true, operations: ['read'] },
      ...['npc', 'touchstone', 'location', 'faction', 'item', 'lore', 'event'].map((entityType) => ({ entityType, label: entityType, enabled: true, operations: rw })),
    ] }
    expect(targetTypes(passport, 'nocturne', 'creature')[0].id).toBe('npc')
    expect(targetTypes(passport, 'nocturne', 'map')[0].id).toBe('location')
    for (const type of ['rumor', 'letter', 'handout', 'note', 'audience', 'home-rule'] as const) expect(targetTypes(passport, 'nocturne', type)[0].id).toBe('lore')
    expect(targetTypes(passport, 'nocturne', 'npc').map((t) => t.id)).not.toContain('character')
  })
})

describe('связи Ноктюрна при импорте (14-B)', () => {
  const items = [
    item({ id: 'n1', type: 'npc', name: 'Принц', relations: [{ targetId: 'f1', type: 'Враг', direction: 'out', comment: 'Давит', visibility: 'master' }, { targetId: 'pc1', type: 'Союзник', direction: 'none', comment: '', visibility: 'public' }] }),
    item({ id: 'f1', type: 'faction', name: 'Анархи', relations: [{ targetId: 'n1', type: 'Враг', direction: 'in', comment: 'Давит', visibility: 'master' }] }),
    item({ id: 'pc1', type: 'character', name: 'Вера', relations: [{ targetId: 'n1', type: 'Союзник', direction: 'none', comment: '', visibility: 'public' }, { targetId: 'x9', type: 'Сир', direction: 'in', comment: '', visibility: 'master' }] }),
  ]

  it('каждая связь один раз, с типом и направлением; конец вне библиотеки — нет связи', () => {
    const base = blankCampaign('Детройт', '', '2026-10-03T00:00:00.000Z')
    const { campaign } = importItems(base, 'nocturne', 'c1', items, '2026-10-03T00:00:00.000Z')
    const name = (id: string) => campaign.entities.find((entity) => entity.id === id)!.name
    const links = campaign.relations.map((relation) => [name(relation.fromId), name(relation.toId), relation.label, relation.type, relation.direction, relation.visibility])
    expect(links).toEqual(expect.arrayContaining([
      ['Принц', 'Анархи', 'Враг: Давит', 'enmity', 'directed', 'master'],
      ['Принц', 'Вера', 'Союзник', 'alliance', 'mutual', 'public'],
    ]))
    expect(links).toHaveLength(2)
  })

  it('повторный импорт и уже связанные записи не плодят связи', () => {
    const base = blankCampaign('Детройт', '', '2026-10-03T00:00:00.000Z')
    const first = importItems(base, 'nocturne', 'c1', items.slice(0, 1), '2026-10-03T00:00:00.000Z').campaign
    expect(first.relations).toHaveLength(0)
    const second = importItems(first, 'nocturne', 'c1', items, '2026-10-03T00:00:00.000Z').campaign
    expect(second.relations).toHaveLength(2)
    const third = importItems(second, 'nocturne', 'c1', items, '2026-10-03T00:00:00.000Z').campaign
    expect(third.relations).toHaveLength(2)
  })

  it('у других систем связей нет — граф не трогается', () => {
    const base = { ...blankCampaign('Порт', '', '2026-10-03T00:00:00.000Z'), entities: [newEntity({ type: 'npc', name: 'x' })] }
    expect(importItems(base, 'lorebook', 'w1', [item({ id: 'e1', type: 'character', name: 'Ждан' })], 'now').campaign.relations).toEqual([])
  })
})

describe('итоги в Ноктюрн', () => {
  const session = {
    ...blankSession(7, 'Сова', '2026-10-03T08:00:00.000Z', 's7'), title: 'Склад', reviewNotes: 'Склад сгорел.',
    log: [
      { id: 'l1', kind: 'decision' as const, text: 'Вера ушла', createdAt: '' },
      { id: 'l2', kind: 'entity' as const, text: 'Новая фракция в Корктауне', createdAt: '' },
    ],
  }

  it('резюме без «Нового в мире», новости — отдельным постом (11-B)', () => {
    const { recap, news } = nocturnePosts(session, () => '')
    expect(recap.title).toBe('Сессия №7 — Склад')
    expect(recap.body).toContain('Решения:\n— Вера ушла')
    expect(recap.body).not.toContain('Новая фракция')
    expect(news).toEqual({ title: 'Новое в мире — Сессия №7 — Склад', body: '— Новая фракция в Корктауне' })
    expect(nocturnePosts({ ...session, log: [] }, () => '').news).toBeNull()
  })

  it('дата игры — только ГГГГ-ММ-ДД, время как написано (12-B)', () => {
    expect(nocturneNextSession({ date: '2026-10-18', time: ' 19:00 ' })).toEqual({ date: '2026-10-18', time: '19:00' })
    expect(nocturneNextSession({ date: '', time: '19:00' })).toBeUndefined()
    expect(nocturneDateText('2026-10-18', '19:00')).toBe('18.10.26, 19:00')
  })
})

describe('стол Ноктюрна одной панелью (10-B, 15-A)', () => {
  const state: NocturneState = {
    fetchedAt: '',
    campaign: { name: 'Детройт', system: 'vtm5', nextSession: { date: '2026-10-11', time: '19:00' }, tenets: ['Без лишней крови'] },
    party: [{ id: 'pc1', name: 'Вера', subtitle: 'Тореадор · Стен', flags: [], statuses: [], tracks: [
      { label: 'Здоровье', max: 5, damage: [{ label: 'Поверхностный', count: 1 }, { label: 'Тяжёлый', count: 2 }] },
      { label: 'Голод', value: 2, max: 5 },
      { label: 'Человечность', value: 7, max: 10, damage: [{ label: 'Пятна', count: 1 }] },
    ] }],
    journal: [], requests: [],
    districts: [
      { id: 'corktown', name: 'Корктаун', factionId: 'f1', faction: 'Анархи', tension: 3, tensionLabel: 'Волнения', description: '', unavailable: false },
      { id: 'delray', name: 'Делрей', factionId: '', faction: '', tension: 0, tensionLabel: 'Покой', description: '', unavailable: false },
    ],
    factions: [{ id: 'f1', name: 'Анархи' }],
  }

  it('треки строкой: урон складывается, пятна не считаются клетками', () => {
    expect(trackText(state.party[0].tracks[0])).toBe('Здоровье 3/5 (поверхностный 1, тяжёлый 2)')
    expect(trackText(state.party[0].tracks[1])).toBe('Голод 2/5')
    expect(trackText(state.party[0].tracks[2])).toBe('Человечность 7/10 (пятна 1)')
  })

  it('вид стола: дата с временем, устои, районы — только тронутые', () => {
    const view = nocturneView(state)
    expect(view.facts).toContainEqual({ label: 'Следующая игра', value: '11.10.26, 19:00' })
    expect(view.note).toBe('Устои: Без лишней крови')
    expect(view.districts!.filter(notableDistrict).map((d) => d.id)).toEqual(['corktown'])
  })
})
