// Masterboard ↔ lorebook / lovegame / systemsetup / kk9 through lorebridge
// (docs/contracts/lorebridge-masterboard.md, decisions F2–F4).

import type { CapabilityPassport, ExternalSystem, PublicationOperation } from '../model/external'
import { fieldValueEqual } from '../storage/fieldMerge'
import { ENTITY_FIELDS, newEntity } from './domain'
import type { CampaignLink, EntitySnapshot, EntitySource, LocalCampaignEntity, LocalCampaignEntityType, LocalCampaignRecord } from './types'

/** A record as lorebridge returns it from GET /mb/entities. */
export interface ExternalItem {
  id: string
  type: string
  name: string
  summary: string
  tags: string[]
  /** Card fields by their label on the other side. */
  fields: Record<string, string>
  visibility: 'public' | 'master'
  /** lorebook sends it; lovegame and systemsetup have no statuses. */
  status?: string
  archived: boolean
  updatedAt: number
  url?: string
}

/** GET /mb/schema (ТЗ-2, R2): card fields of each record type there. */
export type ExternalSchema = Array<{ type: string; fields: Array<{ label: string; long?: boolean }> }>

/** GET /mb/entities: readable records plus the ids of every live record of the type. */
export interface ExternalListing { items: ExternalItem[]; ids: string[] }

/** The body of POST /mb/publish, apart from routing. */
export interface ExternalPatch {
  name?: string
  summary?: string
  tags?: string[]
  fields?: Record<string, string>
  visibility?: 'public' | 'master'
  status?: string
}

export const SYSTEM_LABEL: Record<ExternalSystem, string> = { lorebook: 'Лорбук', lovegame: 'ЛавГеймс', systemsetup: 'SystemSetup', kk9: 'КК9' }
/** Systems a campaign links to (decision F4, R1): a world, a table and a game system. */
export const LINKABLE_SYSTEMS = ['lorebook', 'lovegame', 'kk9', 'systemsetup'] as const
export type LinkableSystem = typeof LINKABLE_SYSTEMS[number]
/**
 * Systems a campaign can publish to; systemsetup is read-only (decision E4).
 * kk9 takes only NPCs (into its library) and items (into its catalog) — the
 * passport says so, and the queue offers nothing else there.
 */
export const WRITABLE_SYSTEMS: ExternalSystem[] = ['lorebook', 'lovegame', 'kk9']

// ─── Roles (ТЗ-2, R3): world, table, system ─────────────────────────────────

/**
 * What a system is for a campaign. Lorebook is the **world** (lore lives there),
 * ЛавГеймс and КК9 are kinds of **table** (characters and their stats live
 * there; one table per campaign), SystemSetup is the **system** (rules, read-only).
 */
export type CampaignRole = 'world' | 'table' | 'system'
export const ROLE_OF: Record<ExternalSystem, CampaignRole> = { lorebook: 'world', lovegame: 'table', kk9: 'table', systemsetup: 'system' }
export const ROLE_SYSTEMS: Record<CampaignRole, ExternalSystem[]> = { world: ['lorebook'], table: ['lovegame', 'kk9'], system: ['systemsetup'] }
export const ROLE_LABEL: Record<CampaignRole, string> = { world: 'Мир', table: 'Стол', system: 'Система' }
export const ROLE_HINT: Record<CampaignRole, string> = {
  world: 'Лор: локации, фракции, события, статьи',
  table: 'Персонажи, НПС, предметы и их статы',
  system: 'Правила и поля карточек',
}
/** Roles a campaign can send entities to; the system is read-only (decision E4). */
export type WritableRole = 'world' | 'table'
export const WRITABLE_ROLES: WritableRole[] = ['world', 'table']

/** The system linked for a role, with its link; the first one wins if an old campaign has two tables. */
export function linkedRole(campaign: Pick<LocalCampaignRecord, 'integrations'>, role: CampaignRole): { system: ExternalSystem; link: CampaignLink } | null {
  for (const system of ROLE_SYSTEMS[role]) { const link = campaign.integrations[system]; if (link) return { system, link } }
  return null
}

/** Links `system` for its role; another system of the same role (the other table) is unlinked. */
export function withLink(campaign: LocalCampaignRecord, system: ExternalSystem, link: CampaignLink | null): LocalCampaignRecord {
  const integrations = { ...campaign.integrations }
  for (const other of ROLE_SYSTEMS[ROLE_OF[system]]) delete integrations[other]
  if (link) integrations[system] = link
  return { ...campaign, integrations }
}

/** Where each type goes by default (R3): lore → world, characters and things → table, the rest stays here. */
export const DEFAULT_RULES: Record<LocalCampaignEntityType, WritableRole[]> = {
  location: ['world'], faction: ['world'], event: ['world'], lore: ['world'], rumor: ['world'], map: ['world'],
  character: ['table'], npc: ['table'], creature: ['table'], item: ['table'], handout: ['table'], letter: ['table'],
  note: [], audience: [], 'home-rule': [],
}
export const rulesFor = (campaign: Pick<LocalCampaignRecord, 'publishRules'>, type: LocalCampaignEntityType): WritableRole[] => campaign.publishRules?.[type] ?? DEFAULT_RULES[type]

/** Roles this entity goes to: its own choice, or the type's rule; only roles the campaign has linked. */
export function entityRoles(campaign: Pick<LocalCampaignRecord, 'integrations' | 'publishRules'>, entity: Pick<LocalCampaignEntity, 'type' | 'destinations'>): WritableRole[] {
  return (entity.destinations ?? rulesFor(campaign, entity.type)).filter((role) => WRITABLE_ROLES.includes(role) && linkedRole(campaign, role))
}

/** Connection key for a role's link. SystemSetup links a system inside the single `packs` connection. */
export const roleConnection = (system: ExternalSystem, link: CampaignLink) => connectionKey(system, link.connectionId ?? link.externalId)

/** A world, table or system a campaign can be based on (ТЗ-2, R1/R10). */
export interface BaseOption { system: ExternalSystem; externalId: string; label: string; url?: string; connectionId?: string }
export const linkOf = (option: BaseOption, checkedAt?: string): CampaignLink => ({ externalId: option.externalId, label: option.label, ...(option.url ? { url: option.url } : {}), ...(option.connectionId ? { connectionId: option.connectionId } : {}), ...(checkedAt ? { checkedAt } : {}) })

/** The base chosen when creating a campaign, by role. */
export type BaseChoice = Partial<Record<CampaignRole, BaseOption>>
export const baseIntegrations = (choice: BaseChoice): LocalCampaignRecord['integrations'] =>
  Object.fromEntries(Object.values(choice).filter((option): option is BaseOption => Boolean(option)).map((option) => [option.system, linkOf(option)]))
/** First chosen base, for a campaign created without a name. */
export const baseName = (choice: BaseChoice) => (choice.table ?? choice.world ?? choice.system)?.label ?? ''

export const connectionKey = (system: ExternalSystem, externalId: string) => `${system}:${externalId}`
export function parseConnectionKey(key: string): { system: ExternalSystem; externalId: string } {
  const at = key.indexOf(':')
  return { system: key.slice(0, at) as ExternalSystem, externalId: key.slice(at + 1) }
}

/** Default type on the other side for each Masterboard type (decision F3). */
export const TARGET_TYPE: Record<'lorebook' | 'lovegame', Record<LocalCampaignEntityType, string>> = {
  lorebook: { character: 'character', npc: 'character', creature: 'character', location: 'location', faction: 'faction', rumor: 'lore', item: 'item', audience: 'note', note: 'note', letter: 'lore', handout: 'lore', map: 'location', 'home-rule': 'note', event: 'event', lore: 'lore' },
  lovegame: { character: 'npc', npc: 'npc', creature: 'codex', location: 'codex', faction: 'codex', rumor: 'codex', item: 'codex', audience: 'codex', note: 'codex', letter: 'handout', handout: 'handout', map: 'handout', 'home-rule': 'codex', event: 'codex', lore: 'codex' },
}

/**
 * КК9: each library kind is its own destination (light / hard NPC, boss,
 * curator, companion, daemon), chosen in the queue; the table only picks the
 * default. A character goes as a light NPC, a creature as a companion.
 */
const KK9_TARGET: Partial<Record<LocalCampaignEntityType, string>> = { npc: 'npc-light', character: 'npc-light', creature: 'companion', item: 'item', location: 'place', map: 'place' }

/** Masterboard type for a record read from another system. */
const IMPORT_TYPE: Record<ExternalSystem, Record<string, LocalCampaignEntityType>> = {
  lorebook: { character: 'npc', location: 'location', faction: 'faction', item: 'item', event: 'event', lore: 'lore', note: 'note' },
  lovegame: { npc: 'npc', handout: 'handout', codex: 'note' },
  systemsetup: { system: 'home-rule' },
  // КК9: сцена — место (аудит М0, решение Р-А).
  kk9: {
    character: 'character', place: 'location', item: 'item',
    'npc-light': 'npc', 'npc-hard': 'npc', 'npc-boss': 'npc', curator: 'npc', 'npc-board': 'npc', companion: 'creature', daemon: 'creature',
    // Прежнее общее имя видов библиотеки — у источников, заведённых до видов.
    npc: 'npc',
  },
}
export const importType = (system: ExternalSystem, type: string): LocalCampaignEntityType => IMPORT_TYPE[system][type] ?? 'note'

/** Types the destination accepts for a new record; the table's choice first when it is among them. */
export function targetTypes(passport: CapabilityPassport | undefined, system: ExternalSystem, type: LocalCampaignEntityType): Array<{ id: string; label: string }> {
  const preferred = system === 'lorebook' || system === 'lovegame' ? TARGET_TYPE[system][type] : system === 'kk9' ? KK9_TARGET[type] ?? '' : ''
  const accepted = passport?.entities.filter((entity) => entity.enabled && entity.operations.includes('create')).map((entity) => ({ id: entity.entityType, label: entity.label })) ?? []
  if (!accepted.length) return preferred ? [{ id: preferred, label: preferred }] : []
  return [...accepted.filter((item) => item.id === preferred), ...accepted.filter((item) => item.id !== preferred)]
}

export const sourceFor = (entity: LocalCampaignEntity, system: ExternalSystem, containerId: string): EntitySource | undefined =>
  entity.sources.find((source) => source.system === system && source.containerId === containerId)

// ─── Fields: Masterboard ids ↔ labels on the other side ─────────────────────

const labelOf = (type: LocalCampaignEntityType, key: string) => ENTITY_FIELDS[type].find((field) => field.id === key)?.label ?? key
const keyOf = (type: LocalCampaignEntityType, label: string) => ENTITY_FIELDS[type].find((field) => field.label.toLocaleLowerCase() === label.toLocaleLowerCase())?.id ?? label

/** Card fields keyed by label; fields Masterboard has no slot for keep their label as the key and travel back unchanged. */
export const fieldsByLabel = (entity: Pick<LocalCampaignEntity, 'type' | 'fields'>) =>
  Object.fromEntries(Object.entries(entity.fields).filter(([, value]) => value).map(([key, value]) => [labelOf(entity.type, key), value]))

export const snapshotOf = (entity: LocalCampaignEntity): EntitySnapshot =>
  ({ name: entity.name, description: entity.description, tags: [...entity.tags], fields: { ...entity.fields }, visibility: entity.visibility })

export function snapshotFromItem(item: ExternalItem, type: LocalCampaignEntityType): EntitySnapshot {
  return {
    name: item.name, description: item.summary, tags: item.tags.map((tag) => tag.toLocaleLowerCase()),
    fields: Object.fromEntries(Object.entries(item.fields).filter(([, value]) => value).map(([label, value]) => [keyOf(type, label), value])),
    visibility: item.visibility,
  }
}

/** What goes to the other side for an operation: only the parts players or the destination may see. */
export function patchFor(entity: LocalCampaignEntity, operation: PublicationOperation): ExternalPatch {
  if (operation === 'archive') return {}
  if (operation === 'change-visibility') return { visibility: entity.visibility }
  return { name: entity.name, summary: entity.description, tags: entity.tags, fields: fieldsByLabel(entity), visibility: entity.visibility }
}

/** A record already published there is updated, not created again (and the other way round). */
export function effectiveOperation(entity: LocalCampaignEntity, system: ExternalSystem, containerId: string, operation: PublicationOperation): PublicationOperation {
  const linked = Boolean(sourceFor(entity, system, containerId))
  if (operation === 'create' && linked) return 'update'
  if (operation === 'update' && !linked) return 'create'
  return operation
}

// ─── Import (decision F2) ───────────────────────────────────────────────────

const newSource = (system: ExternalSystem, containerId: string, item: ExternalItem, snapshot: EntitySnapshot, now: string): EntitySource =>
  ({ system, containerId, id: item.id, type: item.type, url: item.url, updatedAt: item.updatedAt, syncedAt: now, snapshot })

/** Adds the chosen records to the library, each linked to its source. Already linked records are skipped. */
export function importItems(campaign: LocalCampaignRecord, system: ExternalSystem, containerId: string, items: ExternalItem[], now: string): { campaign: LocalCampaignRecord; added: number } {
  const linked = new Set(campaign.entities.flatMap((entity) => entity.sources.filter((source) => source.system === system && source.containerId === containerId).map((source) => source.id)))
  const fresh = items.filter((item) => !linked.has(item.id))
  const entities = fresh.map((item) => {
    const type = importType(system, item.type)
    const snapshot = snapshotFromItem(item, type)
    return newEntity({ type, name: snapshot.name, description: snapshot.description, tags: snapshot.tags, fields: snapshot.fields, visibility: snapshot.visibility, status: item.archived ? 'archived' : 'active', origin: { kind: 'import' }, sources: [newSource(system, containerId, item, snapshot, now)] })
  })
  return { campaign: { ...campaign, entities: [...campaign.entities, ...entities] }, added: entities.length }
}

// ─── Refresh from source: field-by-field three-way comparison (decision I4) ─

export interface FieldClash { key: string; label: string; mine: unknown; theirs: unknown }
export interface RefreshPlan { next: LocalCampaignEntity; clashes: FieldClash[]; changed: string[] }

const TOP: Array<{ key: keyof Omit<EntitySnapshot, 'fields'>; label: string }> = [{ key: 'name', label: 'Название' }, { key: 'description', label: 'Описание' }, { key: 'tags', label: 'Теги' }, { key: 'visibility', label: 'Видимость' }]

/**
 * Compares the entity, the source record and the last agreed snapshot. What
 * only the source changed is taken; what only Masterboard changed is kept;
 * what both changed differently is a clash for the master to decide.
 * `next` already has the source's values for clashes; `resolve` swaps in the master's choice.
 */
export function planRefresh(entity: LocalCampaignEntity, source: EntitySource, item: ExternalItem, now: string): RefreshPlan {
  const base = source.snapshot
  const mine = snapshotOf(entity)
  const theirs = snapshotFromItem(item, entity.type)
  const clashes: FieldClash[] = []
  const changed: string[] = []
  const pick = (key: string, label: string, b: unknown, m: unknown, t: unknown) => {
    if (fieldValueEqual(m, t) || fieldValueEqual(t, b)) return m
    if (fieldValueEqual(m, b)) { changed.push(label); return t }
    clashes.push({ key, label, mine: m, theirs: t })
    return t
  }
  const next = { ...entity } as LocalCampaignEntity
  for (const { key, label } of TOP) (next as unknown as Record<string, unknown>)[key] = pick(key, label, base[key], mine[key], theirs[key])
  const fieldKeys = new Set([...Object.keys(base.fields), ...Object.keys(mine.fields), ...Object.keys(theirs.fields)])
  const fields: Record<string, string> = {}
  for (const key of fieldKeys) {
    const value = pick(`fields.${key}`, labelOf(entity.type, key), base.fields[key] ?? '', mine.fields[key] ?? '', theirs.fields[key] ?? '') as string
    if (value) fields[key] = value
  }
  next.fields = fields
  if (item.archived && entity.status !== 'archived') { next.status = 'archived'; changed.push('В архиве') }
  next.sources = entity.sources.map((item_) => item_ === source ? newSource(source.system, source.containerId, item, theirs, now) : item_)
  return { next, clashes, changed }
}

/** Applies the master's choice for each clash: `mine` keeps the Masterboard value (it goes out with the next publication). */
export function resolveRefresh(plan: RefreshPlan, choices: Record<string, 'mine' | 'theirs'>): LocalCampaignEntity {
  const next = { ...plan.next, fields: { ...plan.next.fields } }
  for (const clash of plan.clashes) {
    if (choices[clash.key] !== 'mine') continue
    if (clash.key.startsWith('fields.')) {
      const key = clash.key.slice('fields.'.length)
      if (clash.mine) next.fields[key] = clash.mine as string
      else delete next.fields[key]
    } else (next as unknown as Record<string, unknown>)[clash.key] = clash.mine
  }
  return next
}

// ─── After a publication ────────────────────────────────────────────────────

/** Remembers where each successfully sent entity now lives on the other side. */
export function recordPublished(campaign: LocalCampaignRecord, items: LocalCampaignRecord['publications'], now: string): LocalCampaignRecord {
  const done = items.filter((item) => item.state === 'succeeded' && item.result)
  if (!done.length) return campaign
  const entities = campaign.entities.map((entity) => {
    const mine = done.filter((item) => item.entityId === entity.id)
    if (!mine.length) return entity
    let sources = entity.sources
    for (const item of mine) {
      const { system, externalId } = parseConnectionKey(item.connectionId)
      const previous = sources.find((source) => source.system === system && source.containerId === externalId)
      const source: EntitySource = { system, containerId: externalId, id: item.result!.id, type: item.targetType ?? previous?.type ?? '', url: item.result!.url ?? previous?.url, updatedAt: item.result!.updatedAt, syncedAt: now, snapshot: snapshotOf(entity) }
      sources = previous ? sources.map((item_) => item_ === previous ? source : item_) : [...sources, source]
    }
    return { ...entity, sources }
  })
  return { ...campaign, entities }
}
