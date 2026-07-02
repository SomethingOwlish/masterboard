// Template-driven import. Heuristic parsing of arbitrary generated documents was
// unreliable (it can't know a session's root, or where one NPC ends and the next
// begins, from markup it wasn't given). Instead the system hands the GM a blank
// JSON template covering every module, plus a prompt so an LLM can convert a prose
// / HTML doc into that exact shape. The GM uploads the filled file and it commits
// deterministically — no guessing. See commitTemplate() in store/importing.ts.

export const TEMPLATE_FORMAT = 'masterboard-import/v1'

/** One custom field on a Character / NPC / Misc entry. */
export interface TmplField {
  label: string
  value: string
}

export interface TmplCharacter {
  name: string
  playerName?: string
  portrait?: string
  tags: string[]
  notes?: string
  fields: TmplField[]
}
export interface TmplNpc {
  name: string
  portrait?: string
  tags: string[]
  dead: boolean
  notes?: string
  fields: TmplField[]
}
export interface TmplLocation {
  name: string
  description?: string
  image?: string
  tags: string[]
}
export interface TmplMisc {
  kind: string
  name: string
  body?: string
  tags: string[]
}
export interface TmplEvent {
  column: string // timeline column name; created if it doesn't exist ("Campaign" is the default)
  date: string
  title: string
  body?: string
}
export interface TmplRelation {
  from: string // entity name (matched case-insensitively across every kind)
  to: string
  label?: string
  directed: boolean
}

export interface ParsedTemplate {
  characters: TmplCharacter[]
  npcs: TmplNpc[]
  locations: TmplLocation[]
  misc: TmplMisc[]
  timeline: TmplEvent[]
  relations: TmplRelation[]
  errors: string[] // human-readable problems; import can still proceed with the valid rows
}

export type SectionKey = 'characters' | 'npcs' | 'locations' | 'misc' | 'timeline' | 'relations'
export const SECTION_KEYS: SectionKey[] = ['characters', 'npcs', 'locations', 'misc', 'timeline', 'relations']

/** A blank template with one commented example per section, ready to download. JSON
 *  has no comments, so guidance rides along in `_instructions` and example rows. */
export function blankTemplate(): unknown {
  return {
    _format: TEMPLATE_FORMAT,
    _instructions:
      'Fill the arrays below with your campaign data, then upload this file. ' +
      'Delete the example rows or replace them. Leave a section as [] if you have nothing for it. ' +
      'Entities are de-duplicated by name (case-insensitive), so re-importing an updated file is safe. ' +
      'Relations reference entities by name. Keep this file in any language you like.',
    characters: [
      {
        name: 'Example PC',
        playerName: 'Player name (optional)',
        portrait: 'https://image-url (optional)',
        tags: ['tag-a', 'tag-b'],
        notes: 'Free-text notes / background.',
        fields: [{ label: 'Class', value: 'Ranger' }],
      },
    ],
    npcs: [
      {
        name: 'Example NPC',
        portrait: 'https://image-url (optional)',
        tags: ['ally'],
        dead: false,
        notes: 'What the GM needs to remember about them.',
        fields: [{ label: 'Role', value: 'Innkeeper' }],
      },
    ],
    locations: [
      { name: 'Example Location', description: 'What it is and why it matters.', image: '', tags: ['city'] },
    ],
    misc: [{ kind: 'scene', name: 'Example scene / faction / item', body: 'Anything without its own module.', tags: [] }],
    timeline: [{ column: 'Campaign', date: '1247 AD', title: 'Something happened', body: 'Details (optional).' }],
    relations: [{ from: 'Example PC', to: 'Example NPC', label: 'trusts', directed: true }],
  }
}

/** The copy-paste prompt: hands an LLM the schema so it can turn a messy source
 *  document into a filled template the importer accepts verbatim. */
export function llmFillPrompt(): string {
  return [
    'You convert a tabletop-RPG campaign document into a strict JSON import file.',
    '',
    'Output ONLY a single valid JSON object — no prose, no markdown fences, no comments.',
    'Use exactly this structure (all arrays required; use [] when you have no data):',
    '',
    JSON.stringify(
      {
        _format: TEMPLATE_FORMAT,
        characters: [{ name: '', playerName: '', portrait: '', tags: [], notes: '', fields: [{ label: '', value: '' }] }],
        npcs: [{ name: '', portrait: '', tags: [], dead: false, notes: '', fields: [{ label: '', value: '' }] }],
        locations: [{ name: '', description: '', image: '', tags: [] }],
        misc: [{ kind: 'note', name: '', body: '', tags: [] }],
        timeline: [{ column: 'Campaign', date: '', title: '', body: '' }],
        relations: [{ from: '', to: '', label: '', directed: true }],
      },
      null,
      2,
    ),
    '',
    'Rules:',
    '- Every entity needs a non-empty "name" (for timeline events, "title").',
    '- Player characters → characters; other people → npcs; places → locations.',
    '- Scenes, factions, items, threads, and anything else without its own module → misc,',
    '  choosing a short "kind" (e.g. "scene", "faction", "item", "thread").',
    '- Dated events → timeline; group them with "column" (default "Campaign").',
    '- "relations" reference entities by their exact "name".',
    '- Do NOT invent facts. Preserve the source language. Omit fields you have no value for.',
    '',
    'Here is the document to convert:',
    '',
    '<<<PASTE YOUR DOCUMENT HERE>>>',
  ].join('\n')
}

// --- Parsing / validation -------------------------------------------------------

function asString(v: unknown): string {
  return v == null ? '' : String(v).trim()
}
function asTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => asString(x)).filter(Boolean)
  if (typeof v === 'string') return v.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
  return []
}
function asFields(v: unknown): TmplField[] {
  if (!Array.isArray(v)) return []
  return v
    .map((f) => (f && typeof f === 'object' ? { label: asString((f as Record<string, unknown>).label), value: asString((f as Record<string, unknown>).value) } : null))
    .filter((f): f is TmplField => !!f && (f.label !== '' || f.value !== ''))
}
function rows(json: Record<string, unknown>, key: SectionKey): Record<string, unknown>[] {
  const v = json[key]
  if (v == null) return []
  if (!Array.isArray(v)) return [] // reported by caller
  return v.filter((r): r is Record<string, unknown> => r != null && typeof r === 'object' && !Array.isArray(r))
}

// Example rows shipped in the blank template — dropped silently so a GM who forgot
// to delete them doesn't import "Example PC".
const EXAMPLE_NAMES = new Set(
  ['Example PC', 'Example NPC', 'Example Location', 'Example scene / faction / item', 'Something happened'].map((s) =>
    s.toLowerCase(),
  ),
)
const isExample = (name: string) => EXAMPLE_NAMES.has(name.toLowerCase())

/**
 * Parse + validate a filled template. Tolerant: coerces types, skips blank/example
 * rows, and collects per-section problems in `errors` while still returning every
 * valid row so a partially-broken file still imports what it can.
 */
export function parseTemplate(json: unknown): ParsedTemplate {
  const out: ParsedTemplate = { characters: [], npcs: [], locations: [], misc: [], timeline: [], relations: [], errors: [] }
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    out.errors.push('The file must be a JSON object with the template sections.')
    return out
  }
  const obj = json as Record<string, unknown>
  const fmt = asString(obj._format)
  if (fmt && fmt !== TEMPLATE_FORMAT) out.errors.push(`Unexpected _format "${fmt}" (expected ${TEMPLATE_FORMAT}).`)

  for (const key of SECTION_KEYS) {
    if (obj[key] != null && !Array.isArray(obj[key])) out.errors.push(`"${key}" should be an array; ignoring it.`)
  }

  for (const r of rows(obj, 'characters')) {
    const name = asString(r.name)
    if (!name || isExample(name)) continue
    out.characters.push({
      name,
      playerName: asString(r.playerName) || undefined,
      portrait: asString(r.portrait) || undefined,
      tags: asTags(r.tags),
      notes: asString(r.notes) || undefined,
      fields: asFields(r.fields),
    })
  }
  for (const r of rows(obj, 'npcs')) {
    const name = asString(r.name)
    if (!name || isExample(name)) continue
    out.npcs.push({
      name,
      portrait: asString(r.portrait) || undefined,
      tags: asTags(r.tags),
      dead: r.dead === true,
      notes: asString(r.notes) || undefined,
      fields: asFields(r.fields),
    })
  }
  for (const r of rows(obj, 'locations')) {
    const name = asString(r.name)
    if (!name || isExample(name)) continue
    out.locations.push({
      name,
      description: asString(r.description) || undefined,
      image: asString(r.image) || undefined,
      tags: asTags(r.tags),
    })
  }
  for (const r of rows(obj, 'misc')) {
    const name = asString(r.name)
    if (!name || isExample(name)) continue
    out.misc.push({ kind: asString(r.kind) || 'note', name, body: asString(r.body) || undefined, tags: asTags(r.tags) })
  }
  for (const r of rows(obj, 'timeline')) {
    const title = asString(r.title) || asString(r.name)
    if (!title || isExample(title)) continue
    out.timeline.push({ column: asString(r.column) || 'Campaign', date: asString(r.date), title, body: asString(r.body) || undefined })
  }
  for (const r of rows(obj, 'relations')) {
    const from = asString(r.from)
    const to = asString(r.to)
    if (isExample(from) || isExample(to)) continue // the shipped example relation
    if (!from || !to) {
      if (from || to) out.errors.push(`A relation is missing "from" or "to" (${from || '?'} → ${to || '?'}); skipped.`)
      continue
    }
    out.relations.push({ from, to, label: asString(r.label) || undefined, directed: r.directed !== false })
  }

  return out
}

/** Per-section counts for the pre-import summary. */
export function templateCounts(t: ParsedTemplate): Record<SectionKey, number> {
  return {
    characters: t.characters.length,
    npcs: t.npcs.length,
    locations: t.locations.length,
    misc: t.misc.length,
    timeline: t.timeline.length,
    relations: t.relations.length,
  }
}

export function isTemplateEmpty(t: ParsedTemplate): boolean {
  return SECTION_KEYS.every((k) => (templateCounts(t)[k] ?? 0) === 0)
}
