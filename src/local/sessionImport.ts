// JSON import of prepared sessions: a hand- or LLM-written file in the `masterboard-sessions/v1`
// format becomes draft sessions with scenes, plan items and transitions. Library records,
// secrets, masters, groups and arcs are referenced by name and resolved against the campaign.

import { newEntity, newSecret } from './domain'
import { blankSession, withLocalSessions } from './normalize'
import { nextSessionNumber, validSessionDate } from './sessions'
import type { LocalCampaignEntityType, LocalCampaignRecord, LocalSessionFlow, LocalSessionPlanItem, LocalSessionPlanKind, LocalSessionRecord } from './types'

export const SESSION_IMPORT_FORMAT = 'masterboard-sessions/v1'

type Raw = Record<string, unknown>
type Priority = LocalSessionPlanItem['priority']

const isObject = (value: unknown): value is Raw => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '')
const key = (value: string) => value.trim().toLocaleLowerCase()
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

/**
 * Hints that earlier templates carried as field values. A file filled from such
 * a template may still hold them; they are dropped instead of becoming content.
 */
const TEMPLATE_HINTS = new Set(['О чём эта сессия в одном предложении', 'Главный вопрос или цель', 'С чего начинается игра', 'Что должно произойти в сцене', 'Имя записи из библиотеки'].map((hint) => hint.toLocaleLowerCase()))
const content = (value: unknown): string => { const result = text(value); return TEMPLATE_HINTS.has(key(result)) ? '' : result }

/** Longest title kept as is; a longer one is split into a title and a note. */
export const TITLE_LIMIT = 80

/**
 * Splits a paragraph written as a title: the head up to the first sentence
 * break («. », «: », «? », «! », « — ») becomes the title, the rest the note.
 * Names of NPCs and materials are split at « — » at any length, since
 * «Сага — хроникёр корпорации» is a name plus a description.
 */
export function splitTitle(value: string, kind: LocalSessionPlanKind): { title: string; rest: string } {
  const named = kind === 'npc' || kind === 'material'
  if (value.length <= TITLE_LIMIT && !(named && value.includes(' — '))) return { title: value, rest: '' }
  const breaks = [/[.:](\s)/, /[?!](\s)/, /\s[—–]\s/].map((pattern) => {
    const match = pattern.exec(value.slice(0, TITLE_LIMIT + 1))
    return match && match.index >= 3 ? { at: match.index, keep: /[?!]/.test(match[0][0]), length: match[0].length } : null
  }).filter((entry): entry is { at: number; keep: boolean; length: number } => entry !== null)
  const first = breaks.sort((a, b) => a.at - b.at)[0]
  if (first) {
    const rest = value.slice(first.at + first.length).trim()
    return { title: value.slice(0, first.at + (first.keep ? 1 : 0)).trim(), rest: rest.charAt(0).toLocaleUpperCase() + rest.slice(1) }
  }
  if (value.length <= TITLE_LIMIT) return { title: value, rest: '' }
  const cut = value.lastIndexOf(' ', TITLE_LIMIT)
  return { title: `${value.slice(0, cut > 20 ? cut : TITLE_LIMIT).trim()}…`, rest: value }
}

/** Plan kinds that have a home outside the plan: library records and campaign secrets. */
const RECORD_TYPE: Partial<Record<LocalSessionPlanKind, LocalCampaignEntityType>> = { npc: 'npc', material: 'handout' }

/** Plan kinds by code and by the Russian label shown in the planner. */
const KINDS: Record<string, LocalSessionPlanKind> = {
  scene: 'scene', idea: 'idea', goal: 'goal', event: 'event', question: 'question', secret: 'secret', npc: 'npc', material: 'material', note: 'note', consequence: 'consequence',
  сцена: 'scene', идея: 'idea', цель: 'goal', событие: 'event', вопрос: 'question', секрет: 'secret', нпс: 'npc', персонаж: 'npc', материал: 'material', заметка: 'note', последствие: 'consequence',
}
const PRIORITIES: Record<string, Priority> = {
  required: 'required', desired: 'desired', useful: 'useful', backup: 'backup',
  обязательно: 'required', желательно: 'desired', полезно: 'useful', запас: 'backup',
}

export interface SessionImportResult {
  /** Sessions ready to be appended to the campaign, numbered after the existing ones. */
  sessions: LocalSessionRecord[]
  /** Non-fatal problems: unknown names, bad dates, dropped transitions. */
  warnings: string[]
  /** NPCs, materials and secrets named in the file but missing from the campaign. */
  newRecords: ImportRecord[]
}

/** A record the import can create in the library (NPC, material) or among the secrets. */
export interface ImportRecord { kind: 'npc' | 'material' | 'secret'; name: string }

/**
 * Parses an import file. Accepts `{ format, sessions: [...] }`, a bare array of
 * sessions or a single session object. Throws only when nothing can be imported.
 */
export function parseSessionImport(source: string, campaign: LocalCampaignRecord, fallbackMasterId: string, now: string): SessionImportResult {
  let data: unknown
  try { data = JSON.parse(source) } catch { throw new Error('Файл не похож на JSON — проверьте запятые и кавычки') }
  const rawSessions = Array.isArray(data) ? data : isObject(data) && Array.isArray(data.sessions) ? data.sessions : isObject(data) && ('title' in data || 'scenes' in data) ? [data] : null
  if (!rawSessions) throw new Error('В файле нет списка «sessions»')
  if (isObject(data) && typeof data.format === 'string' && data.format !== SESSION_IMPORT_FORMAT) throw new Error(`Неизвестный формат «${data.format}», ожидается ${SESSION_IMPORT_FORMAT}`)

  const warnings: string[] = []
  const entities = new Map(campaign.entities.map((entity) => [key(entity.name), entity]))
  const secrets = new Map(campaign.secrets.map((secret) => [key(secret.title), secret]))
  let number = nextSessionNumber(campaign)
  const sessions: LocalSessionRecord[] = []

  rawSessions.forEach((raw, index) => {
    if (!isObject(raw)) { warnings.push(`Сессия ${index + 1}: не объект — пропущена`); return }
    const title = text(raw.title) || `Импортированная сессия ${index + 1}`
    const where = `«${title}»`
    const session: LocalSessionRecord = { ...blankSession(number++, fallbackMasterId, now), title }

    const master = text(raw.master)
    if (master) {
      const found = campaign.masters.find((item) => key(item.name) === key(master))
      if (found) session.masterId = found.id
      else warnings.push(`${where}: мастер «${master}» не найден в команде — назначен текущий`)
    }
    const group = text(raw.group)
    if (group) {
      const found = campaign.groups.find((item) => key(item.name) === key(group))
      if (found) session.groupId = found.id
      else warnings.push(`${where}: группа «${group}» не найдена`)
    }
    const arc = text(raw.arc)
    if (arc) {
      const found = campaign.storyArcs.find((item) => key(item.title) === key(arc))
      if (found) session.arcId = found.id
      else warnings.push(`${where}: арка «${arc}» не найдена`)
    }
    const date = text(raw.date)
    if (date && validSessionDate(date)) session.date = date
    else if (date) warnings.push(`${where}: дата «${date}» не в формате ГГГГ-ММ-ДД — не задана`)
    if (text(raw.status) === 'ready') session.status = 'ready'

    for (const field of ['participants', 'inGameTime', 'timelinePosition', 'idea', 'focus', 'opening', 'lines', 'layers', 'systems'] as const) session[field] = content(raw[field])

    /** Long titles split into a title and a note, for one warning per session. */
    let split = 0
    /** Plan items by lowercase title, for transitions. */
    const byTitle = new Map<string, LocalSessionPlanItem>()
    const toItem = (rawItem: unknown, fallbackKind: LocalSessionPlanKind, sceneId?: string): LocalSessionPlanItem | null => {
      if (typeof rawItem === 'string') rawItem = { text: rawItem }
      if (!isObject(rawItem)) return null
      const kindText = key(text(rawItem.kind))
      const kind = fallbackKind === 'scene' ? 'scene' : KINDS[kindText] ?? fallbackKind
      if (kindText && !KINDS[kindText] && fallbackKind !== 'scene') warnings.push(`${where}: тип «${text(rawItem.kind)}» неизвестен — пункт стал заметкой`)
      const priorityText = key(text(rawItem.priority))
      const item: LocalSessionPlanItem = {
        id: `plan-${crypto.randomUUID()}`, source: 'text', text: content(rawItem.title) || content(rawItem.text), kind,
        priority: PRIORITIES[priorityText] ?? 'desired', status: 'prepared',
        role: content(rawItem.role), alternative: text(rawItem.alternative), note: content(rawItem.note), origin: 'prepared',
        // Scenes do not nest: a scene listed inside another one stays top-level.
        ...(sceneId && kind !== 'scene' ? { sceneId } : {}),
      }
      const written = item.text
      if (item.text) {
        const { title, rest } = splitTitle(item.text, kind)
        if (rest) {
          Object.assign(item, { text: title, note: [rest, item.note].filter(Boolean).join('\n\n') })
          split += 1
        }
      }
      const libraryName = content(rawItem.library)
      if (libraryName) {
        const entity = entities.get(key(libraryName))
        if (entity) Object.assign(item, { source: 'library', entityId: entity.id, text: item.text || entity.name })
        else { warnings.push(`${where}: в библиотеке нет «${libraryName}» — пункт добавлен текстом`); item.text ||= libraryName }
      }
      const secretName = content(rawItem.secret)
      if (secretName) {
        const secret = secrets.get(key(secretName))
        if (secret) Object.assign(item, { secretId: secret.id, kind: 'secret', text: item.text || secret.title })
        else { warnings.push(`${where}: секрет «${secretName}» не найден — пункт добавлен текстом`); Object.assign(item, { kind: 'secret', text: item.text || secretName }) }
      }
      if (!item.text) return null
      for (const name of [item.text, written]) if (name && !byTitle.has(key(name))) byTitle.set(key(name), item)
      return item
    }

    for (const rawScene of list(raw.scenes)) {
      const scene = toItem(rawScene, 'scene')
      if (!scene) continue
      session.planItems.push(scene)
      if (isObject(rawScene)) for (const rawItem of list(rawScene.items)) { const item = toItem(rawItem, 'note', scene.id); if (item) session.planItems.push(item) }
    }
    for (const rawItem of list(raw.items)) { const item = toItem(rawItem, 'note'); if (item) session.planItems.push(item) }

    for (const rawFlow of list(raw.transitions)) {
      if (!isObject(rawFlow)) continue
      const from = byTitle.get(key(text(rawFlow.from)))
      const to = byTitle.get(key(text(rawFlow.to)))
      if (!from || !to || from === to) { warnings.push(`${where}: переход «${text(rawFlow.from)}» → «${text(rawFlow.to)}» не найден в плане — пропущен`); continue }
      const flow: LocalSessionFlow = { id: `flow-${crypto.randomUUID()}`, fromItemId: from.id, toItemId: to.id, condition: text(rawFlow.condition) }
      session.flows.push(flow)
    }
    if (split) warnings.push(`${where}: длинные названия (${split}) разделены на название и заметку — проверьте их`)
    sessions.push(session)
  })

  if (!sessions.length) throw new Error('В файле не нашлось ни одной сессии')
  return { sessions, warnings, newRecords: missingRecords(sessions) }
}

const recordKind = (item: LocalSessionPlanItem): ImportRecord['kind'] | null =>
  item.source !== 'text' || item.secretId ? null : item.kind === 'secret' ? 'secret' : RECORD_TYPE[item.kind] ? item.kind as 'npc' | 'material' : null
const recordKey = (kind: ImportRecord['kind'], name: string) => `${kind === 'secret' ? 'secret' : 'entity'}:${key(name)}`

/** Text plan items that name an NPC, a material or a secret, one entry per name. */
function missingRecords(sessions: LocalSessionRecord[]): ImportRecord[] {
  const found = new Map<string, ImportRecord>()
  for (const item of sessions.flatMap((session) => session.planItems)) {
    const kind = recordKind(item)
    if (kind && !found.has(recordKey(kind, item.text))) found.set(recordKey(kind, item.text), { kind, name: item.text })
  }
  return [...found.values()]
}

/**
 * Appends imported sessions to the campaign. With `createRecords`, NPCs and
 * materials missing from the library become library records and missing
 * secrets become campaign secrets; the plan items then link to them, so they
 * show up in the library, the secrets and «where used».
 */
export function applySessionImport(campaign: LocalCampaignRecord, result: SessionImportResult, createRecords: boolean): LocalCampaignRecord {
  let sessions = result.sessions
  const entities = [...campaign.entities]
  const secrets = [...campaign.secrets]
  if (createRecords) {
    const created = new Map<string, string>()
    sessions = sessions.map((session) => ({
      ...session,
      planItems: session.planItems.map((item) => {
        const kind = recordKind(item)
        if (!kind) return item
        const id = recordKey(kind, item.text)
        if (!created.has(id)) {
          if (kind === 'secret') {
            const secret = newSecret({ title: item.text, truth: item.note || item.text, sessionIds: [session.id] })
            secrets.push(secret)
            created.set(id, secret.id)
          } else {
            const entity = newEntity({ type: RECORD_TYPE[kind]!, name: item.text, description: item.note, origin: { kind: 'import', sessionId: session.id } })
            entities.push(entity)
            created.set(id, entity.id)
          }
        } else if (kind === 'secret') {
          const secret = secrets.find((entry) => entry.id === created.get(id))
          if (secret && !secret.sessionIds.includes(session.id)) secret.sessionIds = [...secret.sessionIds, session.id]
        }
        return kind === 'secret' ? { ...item, secretId: created.get(id) } : { ...item, source: 'library' as const, entityId: created.get(id) }
      }),
    }))
  }
  return withLocalSessions({ ...campaign, entities, secrets }, [...campaign.sessionRecords, ...sessions], sessions[0]?.id)
}

/**
 * Downloadable template: one example session plus field notes for a person or an LLM.
 * Free-text fields are left empty; what to write in them sits next to them in
 * `_`-prefixed keys, which the import ignores.
 */
export function sessionImportTemplate(campaign: LocalCampaignRecord): string {
  const npc = campaign.entities.find((entity) => entity.type === 'npc')?.name
  const template = {
    format: SESSION_IMPORT_FORMAT,
    _help: [
      'Заполните массив sessions и загрузите файл кнопкой «Импортировать JSON» в разделе «Сессии». Поля, начинающиеся с «_», — подсказки, импорт их игнорирует.',
      'Каждая сессия создаётся как новый черновик с номером после существующих. Пустые поля можно удалить.',
      'master, group, arc — имена из раздела «Команда» и линий кампании; library — точное название записи в библиотеке; secret — название секрета.',
      'NPC, материалы и секреты, которых ещё нет в кампании, при импорте можно сразу завести в библиотеке и секретах.',
      'date — ГГГГ-ММ-ДД. status — draft (черновик) или ready (готова).',
      'kind: scene, idea, goal, event, question, secret, npc, material, note, consequence (можно по-русски: сцена, идея, цель, событие, вопрос, секрет, нпс, материал, заметка, последствие).',
      'priority: required, desired, useful, backup (или: обязательно, желательно, полезно, запас).',
      'alternative — одинаковая метка у взаимоисключающих вариантов («или»). transitions связывают пункты плана по названию.',
      'title (или text) — короткое название до 80 знаков, подробности — в note. Имя NPC пишите без пояснений: «Сага», а не «Сага — хроникёр». Длинное название импорт разделит сам.',
      'Пункт можно записать просто строкой — он станет заметкой.',
    ],
    sessions: [{
      title: 'Ночь красного прилива',
      date: '', _date: 'ГГГГ-ММ-ДД',
      status: 'draft',
      master: campaign.masters[0]?.name ?? '',
      group: campaign.groups[0]?.name ?? '',
      arc: campaign.storyArcs[0]?.title ?? '',
      participants: '', _participants: 'Кто играет, если не вся группа',
      inGameTime: '', _inGameTime: 'Когда в мире игры, например «третья ночь, после заката»',
      timelinePosition: '', _timelinePosition: 'Место на шкале кампании',
      idea: '', _idea: 'О чём эта сессия в одном предложении',
      focus: '', _focus: 'Главный вопрос или цель',
      opening: '', _opening: 'С чего начинается игра',
      lines: '', layers: '', systems: '',
      scenes: [
        {
          title: 'Пристань',
          priority: 'required',
          note: '', _note: 'Что должно произойти в сцене',
          items: [
            npc ? { kind: 'npc', library: npc, role: 'Проводник', priority: 'required' } : { kind: 'npc', text: 'Лодочник Гран', role: 'Проводник', priority: 'required', _text: 'Нового NPC импорт предложит завести в библиотеке; существующего укажите в library' },
            { kind: 'question', text: 'Кто открыл шлюзы?', priority: 'desired' },
            'Запах гари с верфи',
          ],
        },
        { title: 'Погоня по крышам', priority: 'desired', alternative: 'Путь к маяку' },
        { title: 'Тихий обход по каналам', priority: 'desired', alternative: 'Путь к маяку' },
      ],
      items: [
        { kind: 'material', text: 'Карта нижнего города', priority: 'useful' },
      ],
      transitions: [
        { from: 'Пристань', to: 'Погоня по крышам', condition: 'Героев заметили' },
        { from: 'Пристань', to: 'Тихий обход по каналам', condition: 'Герои остались незамеченными' },
      ],
    }],
  }
  return JSON.stringify(template, null, 2)
}
