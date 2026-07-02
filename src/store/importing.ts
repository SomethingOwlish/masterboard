// Generic JSON → entity import (B8). Given a list of source records and a mapping
// of source keys onto entity properties, build entities and add them to the right
// store. Dedups by name (case-insensitive) against what's already there so a
// re-import / refresh doesn't create duplicates.

import { makeCharacter, makeField, makeLocation, makeMisc, makeNpc } from '../model/defaults'
import type { ParsedTemplate } from '../lib/importTemplate'
import type { EntityKind } from './entities'
import { useCampaign } from './campaign'
import { useChronology } from './chronology'
import { useLocations } from './locations'
import { useMisc } from './misc'
import { useNpcs } from './npcs'
import { useRelations } from './relations'

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

// --- Template import ------------------------------------------------------------
// The JSON mapper above routes homogeneous records from a connected site to one
// kind. A filled import template (see lib/importTemplate.ts) instead carries the
// whole campaign — every kind, explicitly structured — so it commits each section
// deterministically. Dedups by name per kind so re-importing an updated file is safe.

export interface TemplateResult extends ImportResult {
  /** Per-section imported counts, for a clear "what landed where" summary. */
  bySection: Record<string, number>
}

/** Commit a parsed template to every target store. Relations are resolved by name
 *  against the combined entity pool (existing + just-imported) after entities exist. */
export async function commitTemplate(campaignId: string, tmpl: ParsedTemplate): Promise<TemplateResult> {
  // Load every store up front so dedup sets and name→id resolution see current data.
  await Promise.all([
    useNpcs.getState().load(campaignId),
    useLocations.getState().load(campaignId),
    useMisc.getState().load(campaignId),
    useChronology.getState().load(campaignId),
    useRelations.getState().load(campaignId),
  ])

  const seen = {
    pc: new Set(useCampaign.getState().characters.map((c) => c.name.toLowerCase())),
    npc: new Set(useNpcs.getState().npcs.map((n) => n.name.toLowerCase())),
    location: new Set(useLocations.getState().locations.map((l) => l.name.toLowerCase())),
    misc: new Set(useMisc.getState().misc.map((m) => m.name.toLowerCase())),
    timeline: new Set(useChronology.getState().events.map((e) => e.title.toLowerCase())),
  }
  const bySection: Record<string, number> = {}
  const bump = (k: string) => (bySection[k] = (bySection[k] ?? 0) + 1)
  let imported = 0
  let skipped = 0

  for (const c of tmpl.characters) {
    if (seen.pc.has(c.name.toLowerCase())) { skipped++; continue }
    seen.pc.add(c.name.toLowerCase())
    const e = makeCharacter(c.name)
    e.playerName = c.playerName ?? ''
    e.tags = c.tags
    if (c.portrait) e.portrait = c.portrait
    e.fields = c.fields.map((f) => ({ ...makeField('text'), label: f.label, value: f.value }))
    if (c.notes) e.fields.push({ ...makeField('longtext'), label: 'Notes', value: c.notes })
    await useCampaign.getState().addCharacter(e)
    imported++; bump('characters')
  }
  for (const n of tmpl.npcs) {
    if (seen.npc.has(n.name.toLowerCase())) { skipped++; continue }
    seen.npc.add(n.name.toLowerCase())
    const e = makeNpc(n.name)
    e.tags = n.tags
    e.dead = n.dead
    if (n.portrait) e.portrait = n.portrait
    if (n.notes) e.notes = n.notes
    e.fields = n.fields.map((f) => ({ ...makeField('text'), label: f.label, value: f.value }))
    await useNpcs.getState().add(e)
    imported++; bump('npcs')
  }
  for (const l of tmpl.locations) {
    if (seen.location.has(l.name.toLowerCase())) { skipped++; continue }
    seen.location.add(l.name.toLowerCase())
    const e = makeLocation(l.name)
    e.tags = l.tags
    if (l.image) e.image = l.image
    if (l.description) e.description = l.description
    await useLocations.getState().add(e)
    imported++; bump('locations')
  }
  const newMiscKinds = new Set<string>()
  for (const m of tmpl.misc) {
    if (seen.misc.has(m.name.toLowerCase())) { skipped++; continue }
    seen.misc.add(m.name.toLowerCase())
    const e = makeMisc(m.kind || 'note', m.name)
    e.tags = m.tags
    if (m.body) e.body = m.body
    await useMisc.getState().add(e)
    newMiscKinds.add(m.kind || 'note')
    imported++; bump('misc')
  }
  // Register any freshly-used Misc kinds so imported objects get their own group.
  if (newMiscKinds.size > 0) {
    const kinds = useCampaign.getState().campaign?.settings.miscKinds ?? []
    const merged = [...new Set([...kinds, ...newMiscKinds])]
    if (merged.length !== kinds.length) await useCampaign.getState().updateSettings({ miscKinds: merged })
  }

  // Timeline: resolve (or create) the named column, then add each event to it.
  for (const ev of tmpl.timeline) {
    if (seen.timeline.has(ev.title.toLowerCase())) { skipped++; continue }
    seen.timeline.add(ev.title.toLowerCase())
    const wanted = ev.column.trim() || 'Campaign'
    let col = useChronology.getState().columns.find((c) => c.name.toLowerCase() === wanted.toLowerCase())
    if (!col) {
      await useChronology.getState().addColumn(wanted)
      col = useChronology.getState().columns.find((c) => c.name.toLowerCase() === wanted.toLowerCase())
    }
    if (!col) { skipped++; continue }
    await useChronology.getState().addEvent({ columnId: col.id, date: ev.date || ev.title, title: ev.title, body: ev.body })
    imported++; bump('timeline')
  }

  // Relations: build a name→id map across every kind (now that entities exist) and
  // link by name. Silently skip a relation whose endpoints can't be found.
  if (tmpl.relations.length > 0) {
    const byName = new Map<string, string>()
    for (const c of useCampaign.getState().characters) byName.set(c.name.toLowerCase(), c.id)
    for (const n of useNpcs.getState().npcs) byName.set(n.name.toLowerCase(), n.id)
    for (const l of useLocations.getState().locations) byName.set(l.name.toLowerCase(), l.id)
    for (const m of useMisc.getState().misc) byName.set(m.name.toLowerCase(), m.id)
    const existingPairs = new Set(useRelations.getState().relations.map((r) => `${r.fromId}→${r.toId}`))
    for (const rel of tmpl.relations) {
      const fromId = byName.get(rel.from.toLowerCase())
      const toId = byName.get(rel.to.toLowerCase())
      if (!fromId || !toId || existingPairs.has(`${fromId}→${toId}`)) { skipped++; continue }
      existingPairs.add(`${fromId}→${toId}`)
      await useRelations.getState().addRelation({ fromId, toId, label: rel.label, directed: rel.directed })
      imported++; bump('relations')
    }
  }

  return { imported, skipped, bySection }
}
