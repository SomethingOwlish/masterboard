// The «Импорт» section (ТЗ-2, R6): what came in, from where, and what is left to sort out.

import { EXPORT_FORMAT } from './catalog'
import type { EntityFilter } from './domain'
import { newEntity } from './domain'
import type { LocalCampaignEntity, LocalCampaignRecord, LocalImportRecord } from './types'

/** Adds a line to the import history; nothing is logged for an import that took nothing. */
export function logImport(campaign: LocalCampaignRecord, source: string, kind: LocalImportRecord['kind'], count: number, now: string): LocalCampaignRecord {
  if (!count) return campaign
  return { ...campaign, importLog: [...(campaign.importLog ?? []), { id: `import-${crypto.randomUUID()}`, at: now, source, kind, count }].slice(-50) }
}

/**
 * Takes in a file of entities made by «Экспорт» of picked library rows: every
 * entity gets a new id (relations follow it), and remembers it came by import.
 */
export function importEntitiesFile(campaign: LocalCampaignRecord, json: string, now: string): { campaign: LocalCampaignRecord; added: number } {
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { throw new Error('Файл не является JSON') }
  const payload = parsed as { format?: unknown; entities?: unknown; relations?: unknown; campaign?: unknown }
  if (payload?.format !== `${EXPORT_FORMAT}#entities` || !Array.isArray(payload.entities)) throw new Error('Это не файл сущностей Мастерборда. Его делает «Экспорт» в таблице библиотеки.')
  const ids = new Map<string, string>()
  const entities = (payload.entities as LocalCampaignEntity[]).filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string').map((item) => {
    const { id, sources: _sources, destinations: _destinations, ...rest } = item
    const fresh = newEntity({ ...rest, origin: { kind: 'import' } })
    ids.set(id, fresh.id)
    return fresh
  })
  const relations = (Array.isArray(payload.relations) ? payload.relations as LocalCampaignRecord['relations'] : [])
    .filter((relation) => ids.has(relation.fromId) && ids.has(relation.toId))
    .map((relation) => ({ ...relation, id: `relation-${crypto.randomUUID()}`, fromId: ids.get(relation.fromId)!, toId: ids.get(relation.toId)! }))
  const next = { ...campaign, entities: [...campaign.entities, ...entities], relations: [...campaign.relations, ...relations] }
  return { campaign: logImport(next, `Файл сущностей${typeof payload.campaign === 'string' ? ` из «${payload.campaign}»` : ''}`, 'file', entities.length, now), added: entities.length }
}

export interface ImportTask { id: string; label: string; count: number; filter: Partial<EntityFilter> }

/** What is left to sort out after imports; each task opens the library already filtered and disappears when done. */
export function importTasks(campaign: LocalCampaignRecord): ImportTask[] {
  const imported = campaign.entities.filter((entity) => entity.origin.kind === 'import' && entity.status !== 'archived')
  const tasks: ImportTask[] = [
    { id: 'tags', label: 'Без тегов', count: imported.filter((entity) => !entity.tags.length).length, filter: { imported: true, missing: 'tags' } },
    { id: 'description', label: 'Без описания', count: imported.filter((entity) => !entity.description.trim()).length, filter: { imported: true, missing: 'description' } },
    { id: 'notes', label: 'Пришли заметками — проверить тип', count: imported.filter((entity) => entity.type === 'note').length, filter: { imported: true, type: 'note' } },
  ]
  return tasks.filter((task) => task.count > 0)
}
