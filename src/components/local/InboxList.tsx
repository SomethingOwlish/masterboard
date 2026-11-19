import { useState } from 'react'
import { Badge, Button, EmptyState, Select, TextField } from '../../ds'
import { consumeInbox, newInboxItem, type InboxTarget } from '../../local/inbox'
import { ENTITY_TYPES, INBOX_ACTIONS, INBOX_CAPTURE } from '../../local/labels'
import type { LocalCampaignEntityType, LocalCampaignRecord, LocalInboxItem } from '../../local/types'
import { removeWithUndo } from '../toast'
import type { Persist } from './shared'

/**
 * Inbox of quick notes (ТЗ-3, этап 13, В5): the same field, rows and actions on
 * the Overview and in the Control panel. `limit` shows the latest N and a link
 * to all of them (`showAll`).
 */
export function InboxList({ campaign, persist, limit, showAll }: {
  campaign: LocalCampaignRecord
  persist: Persist
  limit?: number
  showAll?: () => void
}) {
  const [text, setText] = useState('')
  const add = () => {
    const raw = text.trim()
    if (!raw) return
    persist({ ...campaign, inbox: [...campaign.inbox, newInboxItem(raw, new Date().toISOString())] })
    setText('')
  }
  const latest = [...campaign.inbox].reverse()
  const shown = limit ? latest.slice(0, limit) : latest
  return <div className="inbox-panel">
    <div className="target-capture">
      <TextField
        aria-label="Быстрая запись"
        value={text}
        placeholder="Мысль, имя, последствие… #тег"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') add() }}
      />
      <Button
        variant="primary"
        icon="plus"
        disabled={!text.trim()}
        onClick={add}
      >
        {INBOX_CAPTURE}
      </Button>
    </div>
    {shown.length > 0 ? <ol
      className="target-inbox--triage"
      aria-label="Разобрать входящие"
    >
      {shown.map((item) => <InboxRow
        key={item.id}
        item={item}
        consume={(target, type) => persist(consumeInbox(campaign, item, target, type))}
        remove={() => removeWithUndo(persist, campaign, { ...campaign, inbox: campaign.inbox.filter((entry) => entry.id !== item.id) }, `Запись «${item.text}»`)}
      />)}
    </ol> : !limit && <EmptyState
      icon="scroll-text"
      title="Входящие разобраны"
      hint="Сюда можно быстро записать мысль, а тип определить позже. Теги — через #."
    />}
    {limit !== undefined && campaign.inbox.length > limit && showAll && <Button size="sm" onClick={showAll}>
      Все входящие · {campaign.inbox.length}
    </Button>}
  </div>
}

/** One quick note with ways to turn it into a record (ТЗ-2, R6): an entity of a chosen type, a task, a clock, a secret, a note. */
function InboxRow({ item, consume, remove }: { item: LocalInboxItem; consume: (target: InboxTarget, type?: LocalCampaignEntityType) => void; remove: () => void }) {
  const [type, setType] = useState<LocalCampaignEntityType>('npc')
  return <li className="inbox-row">
    <div className="inbox-row__text">
      <span>{item.text}</span>
      {item.tags.map((tag) => <Badge key={tag} tone="neutral" size="sm">#{tag}</Badge>)}
      <time>{new Date(item.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
    </div>
    <div className="inbox-row__actions" role="group" aria-label={`Разобрать: ${item.text}`}>
      {INBOX_ACTIONS.map(([target, label]) => target === 'entity'
        ? <span key={target} className="inbox-row__library">
          <Select
            aria-label={`Тип для «${item.text}»`}
            value={type}
            onChange={(event) => setType(event.target.value as LocalCampaignEntityType)}
          >
            {ENTITY_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>

          <Button size="sm" onClick={() => consume(target, type)}>{label}</Button>
        </span>
        : <Button key={target} size="sm" onClick={() => consume(target)}>{label}</Button>)}
      <Button size="sm" tone="danger" icon="trash-2" aria-label={`Удалить: ${item.text}`} onClick={remove} />
    </div>
  </li>
}
