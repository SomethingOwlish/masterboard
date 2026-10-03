// Живой стол (решение 15-A): КК9 и Ноктюрн показываются одной панелью. Каждый
// берег отдаёт своё состояние, здесь оно складывается в общий вид — факты
// стола, партия строками треков, заявки, журнал и (у Ноктюрна) районы карты.

import { KK9_STREAM_LABEL, TENSION_ZONE, type Kk9State } from './kk9'
import { linkedRole } from './integration'
import { NOCTURNE_STREAM_LABEL, nocturneDateText, type NocturneDistrict, type NocturneState, type NocturneTrack } from './nocturne'
import type { CampaignLink, LocalCampaignRecord } from './types'

export type LiveTableSystem = 'kk9' | 'nocturne'
export const LIVE_TABLE_LABEL: Record<LiveTableSystem, string> = { kk9: 'КК9', nocturne: 'Ноктюрн' }
/** «Состояние КК9», «Состояние Ноктюрна». */
export const LIVE_TABLE_OF: Record<LiveTableSystem, string> = { kk9: 'КК9', nocturne: 'Ноктюрна' }

/** Связанный стол с живым состоянием; у ЛавГеймс его нет. */
export function liveTable(campaign: Pick<LocalCampaignRecord, 'integrations'>): { system: LiveTableSystem; link: CampaignLink } | null {
  const linked = linkedRole(campaign, 'table')
  return linked && (linked.system === 'kk9' || linked.system === 'nocturne') ? { system: linked.system, link: linked.link } : null
}

export interface TableMemberView { id: string; name: string; subtitle?: string; lines: string[]; flags: string[]; statuses: Array<{ name: string; term: string }> }
export interface TableView {
  facts: Array<{ label: string; value: string }>
  note?: string
  party: TableMemberView[]
  partyNote?: string
  emptyParty: string
  requestsTitle: string
  requests: Array<{ id: string; kicker: string; name: string; description: string }>
  journalTitle: string
  journal: Array<{ id: string; kicker: string; title: string; body: string; at: number }>
  districts?: NocturneDistrict[]
}

export function kk9View(state: Kk9State): TableView {
  return {
    facts: [
      { label: 'Дата в игре', value: state.campaign.gameDate || '—' },
      { label: 'Погода', value: state.campaign.weather || '—' },
      { label: 'Следующая игра', value: state.campaign.nextSession || 'не назначена' },
    ],
    note: state.campaign.worldNote || undefined,
    party: state.party.map((member) => ({
      id: member.id, name: member.name, statuses: member.statuses, flags: member.stunned ? ['Оглушён'] : [],
      lines: [
        `Тело ${member.physical.damage}/${member.physical.max} · Разум ${member.mental.damage}/${member.mental.max} · Энергия ${member.energy.value}/${member.energy.max}`,
        `Напряжение ${member.tension.current}/${member.tension.max} — ${TENSION_ZONE[member.tension.zone] ?? member.tension.zone}${member.tension.overcap ? ` · перегрузка ${member.tension.overcap}` : ''}`,
      ],
    })),
    partyNote: 'Урон — нанесённый, из максимума клеток; максимумы энергии и напряжения — без поправок статусов.',
    emptyParty: 'Партия в КК9 не собрана.',
    requestsTitle: 'Заявки игроков',
    requests: state.requests.map((request) => ({ id: request.id, kicker: `${request.kind} · ${request.character}`, name: request.name, description: request.description })),
    journalTitle: 'Журнал',
    journal: state.journal.map((page) => ({ id: `${page.stream}-${page.id}`, kicker: KK9_STREAM_LABEL[page.stream], title: page.title, body: page.body, at: page.at })),
  }
}

/** «Здоровье 3/5 (поверхностный 1, тяжёлый 2)», «Голод 2/5». */
export function trackText(track: NocturneTrack): string {
  const marks = (track.damage ?? []).filter((mark) => mark.count > 0)
  const filled = track.value ?? (track.damage ?? []).filter((mark) => mark.label !== 'Пятна').reduce((sum, mark) => sum + mark.count, 0)
  return `${track.label} ${filled}/${track.max}${marks.length ? ` (${marks.map((mark) => `${mark.label.toLocaleLowerCase()} ${mark.count}`).join(', ')})` : ''}`
}

/** Район стоит показывать, когда о нём что-то известно: держатель, напряжение, описание или закрыт. */
export const notableDistrict = (district: NocturneDistrict) => Boolean(district.factionId || district.tension || district.description || district.unavailable)

export function nocturneView(state: NocturneState): TableView {
  const next = state.campaign.nextSession
  return {
    facts: [
      { label: 'Редакция', value: state.campaign.system === 'vtm20' ? 'V20' : state.campaign.system === 'vtm5' ? 'V5' : state.campaign.system || '—' },
      { label: 'Следующая игра', value: next.date ? nocturneDateText(next.date, next.time) : 'не назначена' },
    ],
    note: state.campaign.tenets.length ? `Устои: ${state.campaign.tenets.join(' · ')}` : undefined,
    party: state.party.map((member) => ({ id: member.id, name: member.name, subtitle: member.subtitle || undefined, statuses: member.statuses, flags: member.flags, lines: [member.tracks.map(trackText).join(' · ')] })),
    partyNote: 'Урон — нанесённый; у V5 заполненные клетки — поверхностный и тяжёлый урон вместе.',
    emptyParty: 'В хронике нет активных персонажей.',
    requestsTitle: 'Заявки на опыт',
    requests: state.requests.map((request) => ({ id: request.id, kicker: `${request.kind} · ${request.character}`, name: request.name, description: request.description })),
    journalTitle: 'Хроника',
    journal: state.journal.map((post) => ({ id: post.id, kicker: `${NOCTURNE_STREAM_LABEL[post.stream]} · ${post.kind}`, title: post.title, body: post.body, at: post.at })),
    districts: state.districts,
  }
}
