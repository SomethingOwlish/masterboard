import { ENTITY_LABEL, KIND_LABEL, LOG_KIND, PRIORITY_LABEL, REVIEW_DECISION, SECRET_STATUS, USE_STATUS_LABEL, VISIBILITY_LABEL, sessionStatusText } from './labels'
import { liveSessions } from './sessions'
import { masterName } from './team'
import type { LocalCampaignRecord, LocalSessionPlanItem, LocalSessionRecord } from './types'

export const AI_EXPORT_FORMAT = 'masterboard.session-results/v1'

const ABOUT = 'Итоги игровых сессий настольной ролевой кампании, выгруженные из Мастерборда для чтения ИИ. '
  + 'Сессии идут по номеру. Внутри сессии: паспорт (замысел и фокус), план (что готовил мастер и что из этого сыграно), '
  + 'журнал (что фактически случилось за столом, по времени), разбор после игры, раскрытые секреты, сдвиги часов, '
  + 'появившиеся в мире сущности и задачи. Связи даны именами, а не id. Поле visibility «Только мастерам» — то, чего игроки не знают.'

/** Drops empty strings, empty lists and unset values so the file carries only what was filled in. */
function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '' && !(Array.isArray(item) && !item.length))) as Partial<T>
}

function sessionResults(campaign: LocalCampaignRecord, session: LocalSessionRecord) {
  const entityName = (id?: string) => id ? campaign.entities.find((item) => item.id === id)?.name : undefined
  const secretTitle = (id?: string) => id ? campaign.secrets.find((item) => item.id === id)?.title : undefined
  const clockTitle = (id?: string) => id ? campaign.clocks.find((item) => item.id === id)?.title : undefined
  const itemTitle = (item: LocalSessionPlanItem) => secretTitle(item.secretId) ?? entityName(item.entityId) ?? item.text
  const scene = (id?: string) => { const found = session.planItems.find((item) => item.id === id); return found ? itemTitle(found) : undefined }
  const arc = (id: string) => campaign.storyArcs.find((item) => item.id === id)?.title
  const next = campaign.sessionRecords.find((item) => item.id === session.nextSessionId)
  return compact({
    number: session.number,
    title: session.title,
    status: sessionStatusText(session),
    date: session.date,
    master: masterName(campaign, session.masterId),
    group: campaign.groups.find((item) => item.id === session.groupId)?.name,
    participants: session.participants,
    inGameTime: session.inGameTime,
    timelinePosition: session.timelinePosition,
    arc: arc(session.arcId),
    backgroundArcs: session.backgroundArcIds.map(arc).filter(Boolean),
    idea: session.idea,
    focus: session.focus,
    opening: session.opening,
    plan: session.planItems.map((item) => compact({
      title: itemTitle(item),
      kind: KIND_LABEL[item.kind],
      priority: PRIORITY_LABEL[item.priority],
      status: USE_STATUS_LABEL[item.status],
      scene: scene(item.sceneId),
      details: item.text !== itemTitle(item) ? item.text : undefined,
      alternative: item.alternative,
      note: item.note,
      addedDuringPlay: item.origin === 'live' || undefined,
      reviewDecision: session.reviewDecisions[item.id] ? REVIEW_DECISION[session.reviewDecisions[item.id]] : undefined,
    })),
    transitions: session.flows.map((flow) => compact({ from: scene(flow.fromItemId), to: scene(flow.toItemId), condition: flow.condition })),
    log: session.log.map((entry) => compact({
      at: entry.createdAt,
      kind: LOG_KIND[entry.kind],
      text: entry.text,
      entity: entityName(entry.entityId),
      secret: secretTitle(entry.secretId),
      clock: clockTitle(entry.clockId),
    })),
    review: compact({ status: session.reviewStatus === 'completed' ? 'Разбор завершён' : 'Разбор не завершён', notes: session.reviewNotes }),
    secretsRevealed: campaign.secrets.flatMap((secret) => secret.reveals.filter((reveal) => reveal.sessionId === session.id).map((reveal) => compact({
      secret: secret.title,
      truth: secret.truth,
      status: SECRET_STATUS[reveal.status],
      recipients: [reveal.recipients, ...campaign.players.filter((player) => reveal.recipientIds.includes(player.id)).map((player) => player.name)].filter(Boolean).join(', '),
      note: reveal.note,
    }))),
    clockChanges: session.log.filter((entry) => entry.kind === 'clock').map((entry) => {
      const clock = campaign.clocks.find((item) => item.id === entry.clockId)
      return compact({ clock: clock?.title, change: entry.text, nowAt: clock ? `${clock.value}/${clock.segments}` : undefined })
    }),
    createdEntities: campaign.entities.filter((entity) => entity.origin.sessionId === session.id).map((entity) => compact({
      name: entity.name,
      type: ENTITY_LABEL[entity.type],
      description: entity.description,
      tags: entity.tags,
      visibility: VISIBILITY_LABEL[entity.visibility],
    })),
    tasks: campaign.tasks.filter((task) => task.origin?.sessionId === session.id).map((task) => ({ text: task.text, done: task.done })),
    nextSession: next ? `№${next.number} ${next.title}` : undefined,
    nextGame: session.nextGame && (session.nextGame.date || session.nextGame.time) ? [session.nextGame.date, session.nextGame.time].filter(Boolean).join(' ') : undefined,
  })
}

/**
 * Session results as JSON written for an AI reader: labels instead of codes,
 * names instead of ids, no layout or print settings. `sessionId` — one session; unset — all of them.
 */
export function exportSessionResults(campaign: LocalCampaignRecord, now: string, sessionId?: string): string {
  const sessions = liveSessions(campaign).filter((session) => !sessionId || session.id === sessionId).sort((a, b) => a.number - b.number)
  return JSON.stringify({
    format: AI_EXPORT_FORMAT,
    about: ABOUT,
    exportedAt: now,
    campaign: compact({
      name: campaign.name,
      idea: campaign.idea,
      currentInGameTime: campaign.activeTime,
      masters: campaign.masters.map((master) => master.name),
      players: campaign.players.map((player) => compact({ name: player.name, characters: player.characterIds.map((id) => campaign.entities.find((item) => item.id === id)?.name).filter(Boolean) })),
    }),
    sessions: sessions.map((session) => sessionResults(campaign, session)),
  }, null, 2)
}
