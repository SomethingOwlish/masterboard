// Sorting quick notes (ТЗ-2, R6): an inbox item becomes a record and leaves the inbox.

import { newClock, newEntity, newSecret } from './domain'
import { newTask } from './sessionFlow'
import type { LocalCampaignEntityType, LocalCampaignRecord, LocalInboxItem } from './types'

export type InboxTarget = 'note' | 'task' | 'entity' | 'clock' | 'secret'

/** Hashtags become tags; the rest is the text. */
export function newInboxItem(raw: string, now: string): LocalInboxItem {
  const tags = [...raw.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((match) => match[1].toLocaleLowerCase())
  return { id: `inbox-${crypto.randomUUID()}`, text: raw.replace(/#[\p{L}\p{N}_-]+/gu, '').trim(), tags, createdAt: now }
}

/** Turns an inbox item into a note, task, library entity of `type`, clock or secret. */
export function consumeInbox(campaign: LocalCampaignRecord, item: LocalInboxItem, target: InboxTarget, type: LocalCampaignEntityType = 'note'): LocalCampaignRecord {
  const rest = { ...campaign, inbox: campaign.inbox.filter((entry) => entry.id !== item.id) }
  if (target === 'note') return { ...rest, notes: [...campaign.notes, item.text] }
  if (target === 'task') return { ...rest, tasks: [...campaign.tasks, newTask(item.text, 'inbox')] }
  if (target === 'entity') return { ...rest, entities: [...campaign.entities, newEntity({ type, name: item.text, tags: item.tags, origin: { kind: 'inbox' } })] }
  if (target === 'clock') return { ...rest, clocks: [...campaign.clocks, newClock({ title: item.text })] }
  return { ...rest, secrets: [...campaign.secrets, newSecret({ title: item.text, truth: item.text })] }
}
