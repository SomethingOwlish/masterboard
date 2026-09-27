import { fieldValueEqual } from '../storage/fieldMerge'
import { ENTITY_FIELDS } from './domain'
import type { LocalCampaignEntityType } from './types'

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

type Step = { key: string } | { id: string }

/** `entities[e1].fields.motive` → key/id steps; `(документ)` is the whole campaign. */
function steps(path: string): Step[] {
  if (path === '(документ)') return []
  return [...path.matchAll(/\[([^\]]+)\]|([^.[\]]+)/g)].map((match) => match[1] !== undefined ? { id: match[1] } : { key: match[2] })
}

function setAt(target: unknown, rest: Step[], value: unknown): unknown {
  if (!rest.length) return value
  const [step, ...tail] = rest
  if ('id' in step) {
    const list = Array.isArray(target) ? target as Array<Obj & { id: string }> : []
    const found = list.some((item) => item.id === step.id)
    if (!tail.length && value === undefined) return list.filter((item) => item.id !== step.id)
    if (!found) return tail.length ? list : [...list, value]
    return list.map((item) => item.id === step.id ? setAt(item, tail, value) : item)
  }
  const object: Obj = isObject(target) ? { ...target } : {}
  const next = setAt(object[step.key], tail, value)
  if (next === undefined) delete object[step.key]
  else object[step.key] = next
  return object
}

/** Puts «my» value back where a merge kept the server's (the «моя» choice in the conflict window). */
export function applyMine<T extends Obj>(campaign: T, conflict: MergeConflict): T {
  return setAt(campaign, steps(conflict.path), conflict.mine) as T
}

const SECTION: Record<string, string> = {
  name: 'Название кампании', idea: 'Идея кампании', activeTime: 'Активное время', archived: 'Архив', activeSessionId: 'Идущая сессия',
  masters: 'Мастера', players: 'Игроки', groups: 'Группы', improv: 'Импровизационный лист', dashboardLayouts: 'Раскладка обзора',
  publications: 'Публикация', integrations: 'Связи с системами', notes: 'Опорные точки', sessionRecords: 'Сессии', entities: 'Библиотека',
  relations: 'Связи', storyArcs: 'Сюжет', clocks: 'Часы', secrets: 'Секреты', tasks: 'Задачи', inbox: 'Входящие', relationLayout: 'Граф связей',
}

const FIELD: Record<string, string> = {
  name: 'название', title: 'название', text: 'текст', description: 'описание', summary: 'описание', notes: 'заметки', status: 'статус',
  tags: 'теги', visibility: 'видимость', truth: 'правда', publicVersion: 'публичная версия', condition: 'условие',
  segments: 'сегменты', filled: 'заполнено', planItems: 'план', log: 'журнал', reviewNotes: 'итоги', inGameTime: 'игровое время',
  date: 'дата', idea: 'идея', focus: 'цель', opening: 'стартовая ситуация', stakes: 'ставки', direction: 'направление', label: 'подпись',
  priority: 'приоритет', kind: 'вид', owner: 'владелец', masterId: 'ответственный мастер', progress: 'прогресс',
}

const titleOf = (item: Obj | undefined): string | null => {
  if (!item) return null
  const text = [item.name, item.title, item.text, item.label].find((value) => typeof value === 'string' && value.trim()) as string | undefined
  const number = typeof item.number === 'number' ? `№${item.number}` : ''
  return [number, text?.trim()].filter(Boolean).join(' ') || null
}

/** «Библиотека › Старый смотритель › мотив» — where a conflict is, in words. */
export function conflictPlace(campaign: Obj, conflict: MergeConflict): string {
  const path = steps(conflict.path)
  if (!path.length) return 'Вся кампания'
  const parts: string[] = []
  let here: unknown = campaign
  let item: Obj | undefined
  path.forEach((step, index) => {
    const pick = (list: unknown) => Array.isArray(list) ? (list as Array<Obj & { id: string }>).find((item) => 'id' in step && item.id === step.id) : undefined
    if ('id' in step) {
      item = pick(here) ?? (index === path.length - 1 ? (conflict.mine ?? conflict.theirs) as Obj | undefined : undefined)
      parts.push(titleOf(item) ?? 'запись')
      here = item
    } else if (index > 0 && step.key === 'fields') {
      here = isObject(here) ? here.fields : undefined
    } else {
      const previous = path[index - 1]
      const cardField = previous && 'key' in previous && previous.key === 'fields' && typeof item?.type === 'string'
        ? ENTITY_FIELDS[item.type as LocalCampaignEntityType]?.find((field) => field.id === step.key)?.label.toLocaleLowerCase()
        : undefined
      parts.push(index === 0 ? SECTION[step.key] ?? step.key : cardField ?? FIELD[step.key] ?? step.key)
      here = isObject(here) ? here[step.key] : undefined
    }
  })
  return parts.join(' › ')
}

/**
 * A conflicting value as one line: text as is, a list item by its title,
 * nothing as «удалено». For two lists of lines only what this side has and the
 * other has not is shown — the shared lines are the same on both sides.
 */
export function conflictValue(value: unknown, other?: unknown): string {
  if (value === undefined || value === null) return 'удалено'
  if (typeof value === 'string') return value.trim() ? value : '(пусто)'
  if (typeof value === 'number' || typeof value === 'boolean') return value === true ? 'да' : value === false ? 'нет' : String(value)
  const lines = (list: unknown): list is string[] => Array.isArray(list) && list.every((item) => typeof item === 'string')
  if (lines(value) && lines(other)) {
    const own = value.filter((item) => !other.includes(item))
    return own.length ? own.join(' · ') : value.length < other.length ? 'без пунктов другой версии' : 'тот же набор, другой порядок'
  }
  if (lines(value)) return value.join(' · ') || '(пусто)'
  if (Array.isArray(value)) return `${value.length} шт.`
  return titleOf(value as Obj) ?? 'запись'
}
