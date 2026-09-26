import { newEntity } from './domain'
import { WIDGETS } from './labels'
import { logEntry } from './sessionFlow'
import type { LocalCampaignEntityType, LocalCampaignRecord, LocalDashboardLayout, LocalImprovItem, LocalImprovKind, LocalSessionRecord, LocalWidgetId } from './types'

// ─── Personal overview layout ───────────────────────────────────────────────

export { WIDGETS, WIDGET_LABEL } from './labels'

export const defaultLayout = (): LocalDashboardLayout => ({ order: [...WIDGETS], hidden: [], wide: ['session', 'arcs'] })

export const layoutFor = (campaign: LocalCampaignRecord, masterId: string): LocalDashboardLayout => campaign.dashboardLayouts[masterId] ?? defaultLayout()

export function withLayout(campaign: LocalCampaignRecord, masterId: string, layout: LocalDashboardLayout | null): LocalCampaignRecord {
  const dashboardLayouts = { ...campaign.dashboardLayouts }
  if (layout) dashboardLayouts[masterId] = layout
  else delete dashboardLayouts[masterId]
  return { ...campaign, dashboardLayouts }
}

/** Moves a widget one step among the visible ones. */
export function moveWidget(layout: LocalDashboardLayout, widget: LocalWidgetId, delta: -1 | 1): LocalDashboardLayout {
  const visible = layout.order.filter((id) => !layout.hidden.includes(id))
  const at = visible.indexOf(widget)
  const swapWith = visible[at + delta]
  if (at < 0 || !swapWith) return layout
  const order = [...layout.order]
  const a = order.indexOf(widget), b = order.indexOf(swapWith)
  ;[order[a], order[b]] = [order[b], order[a]]
  return { ...layout, order }
}

const toggle = (list: LocalWidgetId[], id: LocalWidgetId) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
export const toggleHidden = (layout: LocalDashboardLayout, widget: LocalWidgetId): LocalDashboardLayout => ({ ...layout, hidden: toggle(layout.hidden, widget) })
export const toggleWide = (layout: LocalDashboardLayout, widget: LocalWidgetId): LocalDashboardLayout => ({ ...layout, wide: toggle(layout.wide, widget) })

// ─── Improv sheet ───────────────────────────────────────────────────────────

export const IMPROV_KIND: Record<LocalImprovKind, string> = { name: 'Имя', npc: 'NPC', location: 'Место', item: 'Предмет', event: 'Событие', complication: 'Осложнение' }
const ENTITY_FOR: Partial<Record<LocalImprovKind, LocalCampaignEntityType>> = { npc: 'npc', location: 'location', item: 'item' }

export const newImprov = (masterId: string, kind: LocalImprovKind, text: string): LocalImprovItem => ({ id: `improv-${crypto.randomUUID()}`, masterId, kind, text: text.trim() })

export const improvOf = (campaign: LocalCampaignRecord, masterId: string) => campaign.improv.filter((item) => item.masterId === masterId)

/**
 * Uses a prepared improv item. NPCs, places and items become library
 * entries (origin "improv"); in a session the use is logged and the new entry
 * is marked as played in the plan.
 */
export function applyImprov(campaign: LocalCampaignRecord, itemId: string, now: string, session?: LocalSessionRecord): LocalCampaignRecord {
  const item = campaign.improv.find((entry) => entry.id === itemId)
  if (!item || item.usedAt) return campaign
  const type = ENTITY_FOR[item.kind]
  const entity = type ? newEntity({ type, name: item.text, origin: { kind: 'improv', sessionId: session?.id } }) : undefined
  const improv = campaign.improv.map((entry) => entry.id === itemId ? { ...entry, usedAt: now, usedSessionId: session?.id, entityId: entity?.id } : entry)
  let next: LocalCampaignRecord = { ...campaign, improv, entities: entity ? [...campaign.entities, entity] : campaign.entities }
  if (session) {
    const log = logEntry(entity ? 'entity' : 'moment', `Импровизация (${IMPROV_KIND[item.kind].toLocaleLowerCase()}): ${item.text}`, now, entity ? { entityId: entity.id } : {})
    const planItems = entity ? [...session.planItems, { id: `plan-${crypto.randomUUID()}`, source: 'library' as const, entityId: entity.id, text: entity.name, kind: item.kind === 'npc' ? 'npc' as const : 'note' as const, priority: 'useful' as const, status: 'used' as const, role: '', alternative: '', note: '', origin: 'live' as const }] : session.planItems
    next = { ...next, sessionRecords: next.sessionRecords.map((entry) => entry.id === session.id ? { ...entry, log: [...entry.log, log], planItems } : entry) }
  }
  return next
}
