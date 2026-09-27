// Search across the whole campaign (ТЗ-2, R5 B) and what a found record opens.

import { ENTITY_FIELDS } from './domain'
import { liveSessions } from './sessions'
import type { LocalCampaignRecord } from './types'

/** Records a name can open in the side panel (R9). */
export type PeekKind = 'entity' | 'clock' | 'secret' | 'arc' | 'player' | 'session'
export interface PeekTarget { kind: PeekKind; id: string }

export type SearchKind = PeekKind | 'plan'
export interface SearchHit {
  kind: SearchKind
  id: string
  title: string
  detail: string
  /** What opens: a record in the side panel; a plan item opens its session. */
  target: PeekTarget
}

export const SEARCH_GROUP: Record<SearchKind, string> = { entity: 'Библиотека', secret: 'Секреты', clock: 'Часы', arc: 'Сюжет', session: 'Сессии', plan: 'Пункты планов', player: 'Игроки' }
const ORDER: SearchKind[] = ['entity', 'secret', 'clock', 'arc', 'session', 'plan', 'player']

const norm = (value: string) => value.toLocaleLowerCase().replace(/ё/g, 'е')

/**
 * Every word of the query must appear somewhere in the record; hits whose
 * title matches go first. At most `limit` hits per group.
 */
export function searchCampaign(campaign: LocalCampaignRecord, query: string, limit = 6): SearchHit[] {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const hits: Array<SearchHit & { score: number }> = []
  const add = (kind: SearchKind, id: string, title: string, detail: string, haystack: string[], target: PeekTarget = { kind: kind as PeekKind, id }) => {
    const text = norm([title, ...haystack].join(' \n '))
    if (!words.every((word) => text.includes(word))) return
    const inTitle = words.every((word) => norm(title).includes(word))
    hits.push({ kind, id, title, detail, target, score: inTitle ? (norm(title).startsWith(words[0]) ? 0 : 1) : 2 })
  }
  for (const entity of campaign.entities) {
    const fields = ENTITY_FIELDS[entity.type].map((field) => entity.fields[field.id] ?? '')
    add('entity', entity.id, entity.name, entity.status === 'archived' ? 'в архиве' : entity.description, [entity.description, ...entity.tags, ...fields, ...Object.values(entity.fields)])
  }
  for (const secret of campaign.secrets) add('secret', secret.id, secret.title, secret.publicVersion || secret.truth, [secret.truth, secret.publicVersion, secret.revealCondition])
  for (const clock of campaign.clocks) add('clock', clock.id, clock.title, `${clock.value}/${clock.segments}`, [clock.trigger, clock.advanceCondition, clock.rollbackCondition])
  for (const arc of campaign.storyArcs) add('arc', arc.id, arc.title, arc.direction, [arc.direction, arc.stakes, arc.owner])
  for (const session of liveSessions(campaign)) {
    add('session', session.id, `№${session.number} ${session.title}`, session.focus || session.idea, [session.idea, session.focus, session.opening])
    for (const item of session.planItems) {
      const entity = item.entityId ? campaign.entities.find((candidate) => candidate.id === item.entityId) : undefined
      const title = entity?.name ?? item.text
      if (title) add('plan', item.id, title, `Сессия №${session.number}`, [item.text, item.note, item.role], { kind: 'session', id: session.id })
    }
  }
  for (const player of campaign.players) add('player', player.id, player.name, player.note, [player.note])
  hits.sort((left, right) => ORDER.indexOf(left.kind) - ORDER.indexOf(right.kind) || left.score - right.score || left.title.localeCompare(right.title, 'ru'))
  const perGroup = new Map<SearchKind, number>()
  return hits.filter((hit) => { const count = perGroup.get(hit.kind) ?? 0; perGroup.set(hit.kind, count + 1); return count < limit }).map(({ score: _score, ...hit }) => hit)
}
