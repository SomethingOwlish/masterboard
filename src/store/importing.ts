// Generic JSON → entity import (B8). Given a list of source records and a mapping
// of source keys onto entity properties, build entities and add them to the right
// store. Dedups by name (case-insensitive) against what's already there so a
// re-import / refresh doesn't create duplicates.

import { makeCharacter, makeField, makeLocation, makeMisc, makeNpc } from '../model/defaults'
import type { EntityKind } from './entities'
import { useCampaign } from './campaign'
import { useChronology } from './chronology'
import { useLocations } from './locations'
import { useMisc } from './misc'
import { useNpcs } from './npcs'

export type SourceRecord = Record<string, unknown>

export interface FieldMap {
  name: string // required source key → entity name
  tags?: string // source key → tags (array or delimited string)
  image?: string // source key → portrait / image
  body?: string // source key → description / notes / body
  miscKind?: string // literal kind to file imported Misc objects under
}

export interface ImportResult {
  imported: number
  skipped: number
}

function str(rec: SourceRecord, key?: string): string {
  if (!key) return ''
  const v = rec[key]
  return v == null ? '' : String(v).trim()
}

function tagList(rec: SourceRecord, key?: string): string[] {
  if (!key) return []
  const v = rec[key]
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  if (typeof v === 'string') return v.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
  return []
}

/** Pull an array of records out of arbitrary JSON: either the top level is the
 *  array, or it's the value at `arrayKey`. */
export function recordsFrom(json: unknown, arrayKey?: string): SourceRecord[] {
  const raw = arrayKey && json && typeof json === 'object' ? (json as Record<string, unknown>)[arrayKey] : json
  if (!Array.isArray(raw)) return []
  return raw.filter((r): r is SourceRecord => r != null && typeof r === 'object' && !Array.isArray(r))
}

/** Keys that hold an array of objects — candidate sources when JSON isn't a bare array. */
export function arrayKeysOf(json: unknown): string[] {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return []
  return Object.entries(json as Record<string, unknown>)
    .filter(([, v]) => Array.isArray(v) && v.some((x) => x && typeof x === 'object'))
    .map(([k]) => k)
}

/** Union of keys across the first several records — the columns to map from. */
export function keysOf(records: SourceRecord[]): string[] {
  const seen = new Set<string>()
  for (const r of records.slice(0, 25)) for (const k of Object.keys(r)) seen.add(k)
  return [...seen]
}

export async function importEntities(
  campaignId: string,
  kind: EntityKind,
  records: SourceRecord[],
  map: FieldMap,
): Promise<ImportResult> {
  // Ensure the target store is loaded so the dedup set + writes use current data.
  if (kind === 'npc') await useNpcs.getState().load(campaignId)
  if (kind === 'location') await useLocations.getState().load(campaignId)
  if (kind === 'misc') await useMisc.getState().load(campaignId)

  const existingNames = (): Set<string> => {
    const names =
      kind === 'pc'
        ? useCampaign.getState().characters.map((c) => c.name)
        : kind === 'npc'
          ? useNpcs.getState().npcs.map((n) => n.name)
          : kind === 'location'
            ? useLocations.getState().locations.map((l) => l.name)
            : useMisc.getState().misc.map((m) => m.name)
    return new Set(names.map((n) => n.toLowerCase()))
  }
  const seen = existingNames()

  let imported = 0
  let skipped = 0

  for (const rec of records) {
    const name = str(rec, map.name)
    if (!name || seen.has(name.toLowerCase())) {
      skipped++
      continue
    }
    seen.add(name.toLowerCase())
    const tags = tagList(rec, map.tags)
    const image = str(rec, map.image) || undefined
    const body = str(rec, map.body) || undefined

    if (kind === 'pc') {
      const c = makeCharacter(name)
      c.tags = tags
      if (image) c.portrait = image
      if (body) c.fields = [{ ...makeField('longtext'), label: map.body ?? 'Notes', value: body }]
      await useCampaign.getState().addCharacter(c)
    } else if (kind === 'npc') {
      const n = makeNpc(name)
      n.tags = tags
      if (image) n.portrait = image
      if (body) n.notes = body
      await useNpcs.getState().add(n)
    } else if (kind === 'location') {
      const l = makeLocation(name)
      l.tags = tags
      if (image) l.image = image
      if (body) l.description = body
      await useLocations.getState().add(l)
    } else {
      const m = makeMisc(map.miscKind || 'note', name)
      m.tags = tags
      if (body) m.body = body
      await useMisc.getState().add(m)
    }
    imported++
  }

  // Register a new Misc kind so imported objects get their own group.
  if (kind === 'misc' && imported > 0 && map.miscKind) {
    const kinds = useCampaign.getState().campaign?.settings.miscKinds ?? []
    if (!kinds.includes(map.miscKind)) {
      await useCampaign.getState().updateSettings({ miscKinds: [...kinds, map.miscKind] })
    }
  }

  return { imported, skipped }
}

// --- Document import: per-item routing (parser wizard) --------------------------
// The JSON mapper above routes homogeneous records to one kind. A parsed document
// (Markdown / HTML / SVG) yields heterogeneous blocks the GM routes individually,
// so this commits a list where each item names its own target.

/** Where a parsed block can be filed. 'timeline' adds a Campaign-column event. */
export type RouteKind = EntityKind | 'timeline' | 'skip'

/** A parsed block after the GM has confirmed its routing, ready to commit. */
export interface RoutedEntity {
  route: RouteKind
  name: string
  body: string
  tags: string[]
  image?: string
  miscKind?: string // when route === 'misc'
  date?: string // when route === 'timeline'
}

/** Suggest a route from a block's title/body so the GM starts from a sensible default. */
export function guessRoute(title: string, body: string): RouteKind {
  const t = `${title} ${body}`.toLowerCase()
  if (/\b(\d{3,4}\s?(ad|bc|ce|bce)|year|era|age of|century|on the \w+ day)\b/.test(t)) return 'timeline'
  if (/\b(city|town|village|castle|keep|forest|tavern|inn|dungeon|region|realm|kingdom|temple|ruins?|mountains?)\b/.test(t))
    return 'location'
  if (/\b(npc|villain|ally|merchant|guard|king|queen|lord|lady|priest|captain|innkeeper)\b/.test(t)) return 'npc'
  if (/\b(player character|\bpc\b|party member|protagonist)\b/.test(t)) return 'pc'
  return 'misc'
}

/** Commit routed blocks to their target stores. Dedups by name per kind (and by
 *  title for timeline) so a re-parse doesn't duplicate. Returns counts. */
export async function commitRoutedEntities(campaignId: string, items: RoutedEntity[]): Promise<ImportResult> {
  const active = items.filter((it) => it.route !== 'skip' && it.name.trim())
  const kinds = new Set(active.map((it) => it.route))

  // Load every target store up front so dedup sets and writes see current data.
  if (kinds.has('npc')) await useNpcs.getState().load(campaignId)
  if (kinds.has('location')) await useLocations.getState().load(campaignId)
  if (kinds.has('misc')) await useMisc.getState().load(campaignId)
  if (kinds.has('timeline')) await useChronology.getState().load(campaignId)

  const seen = {
    pc: new Set(useCampaign.getState().characters.map((c) => c.name.toLowerCase())),
    npc: new Set(useNpcs.getState().npcs.map((n) => n.name.toLowerCase())),
    location: new Set(useLocations.getState().locations.map((l) => l.name.toLowerCase())),
    misc: new Set(useMisc.getState().misc.map((m) => m.name.toLowerCase())),
    timeline: new Set(useChronology.getState().events.map((e) => e.title.toLowerCase())),
  }
  const newMiscKinds = new Set<string>()
  const campaignColumn = useChronology.getState().columns.find((c) => c.fixed) ?? useChronology.getState().columns[0]

  let imported = 0
  let skipped = 0

  for (const it of active) {
    const key = it.name.toLowerCase()
    const bucket = it.route === 'pc' ? seen.pc : seen[it.route as keyof typeof seen]
    if (bucket?.has(key)) {
      skipped++
      continue
    }
    bucket?.add(key)

    if (it.route === 'pc') {
      const c = makeCharacter(it.name)
      c.tags = it.tags
      if (it.image) c.portrait = it.image
      if (it.body) c.fields = [{ ...makeField('longtext'), label: 'Notes', value: it.body }]
      await useCampaign.getState().addCharacter(c)
    } else if (it.route === 'npc') {
      const n = makeNpc(it.name)
      n.tags = it.tags
      if (it.image) n.portrait = it.image
      if (it.body) n.notes = it.body
      await useNpcs.getState().add(n)
    } else if (it.route === 'location') {
      const l = makeLocation(it.name)
      l.tags = it.tags
      if (it.image) l.image = it.image
      if (it.body) l.description = it.body
      await useLocations.getState().add(l)
    } else if (it.route === 'timeline') {
      if (!campaignColumn) {
        skipped++
        continue
      }
      await useChronology.getState().addEvent({
        columnId: campaignColumn.id,
        date: it.date?.trim() || it.name,
        title: it.name,
        body: it.body || undefined,
      })
    } else {
      const kind = it.miscKind?.trim() || 'note'
      const m = makeMisc(kind, it.name)
      m.tags = it.tags
      if (it.body) m.body = it.body
      await useMisc.getState().add(m)
      newMiscKinds.add(kind)
    }
    imported++
  }

  // Register any freshly-used Misc kinds so imported objects get their own group.
  if (newMiscKinds.size > 0) {
    const kinds = useCampaign.getState().campaign?.settings.miscKinds ?? []
    const merged = [...new Set([...kinds, ...newMiscKinds])]
    if (merged.length !== kinds.length) await useCampaign.getState().updateSettings({ miscKinds: merged })
  }

  return { imported, skipped }
}
