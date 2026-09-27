// JSON import of prepared sessions: a hand- or LLM-written file in the `masterboard-sessions/v1`
// format becomes draft sessions with scenes, plan items and transitions. Library records,
// secrets, masters, groups and arcs are referenced by name and resolved against the campaign.

import { blankSession } from './normalize'
import { nextSessionNumber, validSessionDate } from './sessions'
import type { LocalCampaignRecord, LocalSessionFlow, LocalSessionPlanItem, LocalSessionPlanKind, LocalSessionRecord } from './types'

export const SESSION_IMPORT_FORMAT = 'masterboard-sessions/v1'

type Raw = Record<string, unknown>
type Priority = LocalSessionPlanItem['priority']

const isObject = (value: unknown): value is Raw => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '')
const key = (value: string) => value.trim().toLocaleLowerCase()
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

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
}

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

    for (const field of ['participants', 'inGameTime', 'timelinePosition', 'idea', 'focus', 'opening', 'lines', 'layers', 'systems'] as const) session[field] = text(raw[field])

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
        id: `plan-${crypto.randomUUID()}`, source: 'text', text: text(rawItem.title) || text(rawItem.text), kind,
        priority: PRIORITIES[priorityText] ?? 'desired', status: 'prepared',
        role: text(rawItem.role), alternative: text(rawItem.alternative), note: text(rawItem.note), origin: 'prepared',
        // Scenes do not nest: a scene listed inside another one stays top-level.
        ...(sceneId && kind !== 'scene' ? { sceneId } : {}),
      }
      const libraryName = text(rawItem.library)
      if (libraryName) {
        const entity = entities.get(key(libraryName))
        if (entity) Object.assign(item, { source: 'library', entityId: entity.id, text: item.text || entity.name })
        else { warnings.push(`${where}: в библиотеке нет «${libraryName}» — пункт добавлен текстом`); item.text ||= libraryName }
      }
      const secretName = text(rawItem.secret)
      if (secretName) {
        const secret = secrets.get(key(secretName))
        if (secret) Object.assign(item, { secretId: secret.id, kind: 'secret', text: item.text || secret.title })
        else { warnings.push(`${where}: секрет «${secretName}» не найден — пункт добавлен текстом`); Object.assign(item, { kind: 'secret', text: item.text || secretName }) }
      }
      if (!item.text) return null
      if (!byTitle.has(key(item.text))) byTitle.set(key(item.text), item)
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
    sessions.push(session)
  })

  if (!sessions.length) throw new Error('В файле не нашлось ни одной сессии')
  return { sessions, warnings }
}

/** Downloadable template: one filled example session plus field notes for a person or an LLM. */
export function sessionImportTemplate(campaign: LocalCampaignRecord): string {
  const npc = campaign.entities.find((entity) => entity.type === 'npc')?.name ?? 'Имя записи из библиотеки'
  const template = {
    format: SESSION_IMPORT_FORMAT,
    _help: [
      'Заполните массив sessions и загрузите файл кнопкой «Импортировать JSON» в разделе «Сессии». Поля, начинающиеся с «_», игнорируются.',
      'Каждая сессия создаётся как новый черновик с номером после существующих. Пустые поля можно удалить.',
      'master, group, arc — имена из раздела «Команда» и линий кампании; library — точное название записи в библиотеке; secret — название секрета.',
      'date — ГГГГ-ММ-ДД. status — draft (черновик) или ready (готова).',
      'kind: scene, idea, goal, event, question, secret, npc, material, note, consequence (можно по-русски: сцена, идея, цель, событие, вопрос, секрет, нпс, материал, заметка, последствие).',
      'priority: required, desired, useful, backup (или: обязательно, желательно, полезно, запас).',
      'alternative — одинаковая метка у взаимоисключающих вариантов («или»). transitions связывают пункты плана по названию.',
      'Пункт можно записать просто строкой — он станет заметкой.',
    ],
    sessions: [{
      title: 'Ночь красного прилива',
      date: '',
      status: 'draft',
      master: campaign.masters[0]?.name ?? '',
      group: campaign.groups[0]?.name ?? '',
      arc: campaign.storyArcs[0]?.title ?? '',
      participants: '',
      inGameTime: 'Третья ночь, после заката',
      timelinePosition: '',
      idea: 'О чём эта сессия в одном предложении',
      focus: 'Главный вопрос или цель',
      opening: 'С чего начинается игра',
      lines: '', layers: '', systems: '',
      scenes: [
        {
          title: 'Пристань',
          priority: 'required',
          note: 'Что должно произойти в сцене',
          items: [
            { kind: 'npc', library: npc, role: 'Проводник', priority: 'required' },
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
