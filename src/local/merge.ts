import { fieldValueEqual } from '../storage/fieldMerge'

/** A change both masters made to the same thing; the server version was kept. */
export interface MergeConflict { path: string; mine: unknown; theirs: unknown }

type Obj = Record<string, unknown>
const isObject = (value: unknown): value is Obj => value !== null && typeof value === 'object' && !Array.isArray(value)
const isIdList = (value: unknown): value is Array<Obj & { id: string }> => Array.isArray(value) && value.every((item) => isObject(item) && typeof item.id === 'string')

/**
 * Three-way merge of a campaign (decision I4): changes that do not overlap are
 * combined automatically — down to single items of lists with ids (entities,
 * sessions, clocks…) and their fields. When both sides changed the same value
 * differently, the server value wins and the clash is reported for review.
 */
export function mergeCampaign<T extends Obj>(base: T, mine: T, theirs: T): { merged: T; conflicts: MergeConflict[] } {
  const conflicts: MergeConflict[] = []
  const merged = mergeValue(base, mine, theirs, '', conflicts) as T
  return { merged, conflicts }
}

function mergeValue(base: unknown, mine: unknown, theirs: unknown, path: string, conflicts: MergeConflict[]): unknown {
  if (fieldValueEqual(mine, base)) return theirs
  if (fieldValueEqual(theirs, base) || fieldValueEqual(mine, theirs)) return mine
  if (isObject(base) && isObject(mine) && isObject(theirs)) return mergeObject(base, mine, theirs, path, conflicts)
  if (isIdList(base) && isIdList(mine) && isIdList(theirs)) return mergeList(base, mine, theirs, path, conflicts)
  conflicts.push({ path: path || '(документ)', mine, theirs })
  return theirs
}

function mergeObject(base: Obj, mine: Obj, theirs: Obj, path: string, conflicts: MergeConflict[]): Obj {
  const keys = new Set([...Object.keys(base), ...Object.keys(mine), ...Object.keys(theirs)])
  const out: Obj = {}
  for (const key of keys) {
    const value = mergeValue(base[key], mine[key], theirs[key], path ? `${path}.${key}` : key, conflicts)
    if (value !== undefined) out[key] = value
  }
  return out
}

/** Merges lists of `{id}` items by id; order follows the server, new local items go to the end. */
function mergeList(base: Array<Obj & { id: string }>, mine: Array<Obj & { id: string }>, theirs: Array<Obj & { id: string }>, path: string, conflicts: MergeConflict[]): unknown[] {
  const byId = (list: Array<Obj & { id: string }>) => new Map(list.map((item) => [item.id, item]))
  const b = byId(base), m = byId(mine), t = byId(theirs)
  const order = [...theirs.map((item) => item.id), ...mine.map((item) => item.id).filter((id) => !t.has(id))]
  const out: unknown[] = []
  for (const id of order) {
    const value = mergeValue(b.get(id), m.get(id), t.get(id), `${path}[${id}]`, conflicts)
    if (value !== undefined) out.push(value)
  }
  return out
}
