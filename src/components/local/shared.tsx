import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Icon } from '../../ds'
import { LocalThemeControl } from '../LocalThemeControl'
import type { LocalCampaignEntityType, LocalCampaignRecord } from '../../local/types'

export type Persist = (next: LocalCampaignRecord) => void
export interface SectionProps { campaign: LocalCampaignRecord; persist: Persist }

export const CAMPAIGN_SECTIONS = [
  { id: 'overview', label: 'Обзор', icon: 'layout-dashboard' },
  { id: 'session', label: 'Сессии', icon: 'clapperboard' },
  { id: 'arcs', label: 'Сюжет', icon: 'waypoints' },
  { id: 'control', label: 'Пульт', icon: 'list-checks' },
  { id: 'library', label: 'Библиотека', icon: 'library' },
  { id: 'map', label: 'Связи', icon: 'share-2' },
  { id: 'world', label: 'Заметки', icon: 'book-open' },
] as const

/** Every `section` route value the campaign page understands. */
export const KNOWN_SECTIONS = new Set<string>([...CAMPAIGN_SECTIONS.map((item) => item.id), 'play', 'review'])

const SESSION_MODES = new Set(['session', 'play', 'review'])

export function CampaignNav({ campaignId, section, className }: { campaignId: string; section: string; className?: string }) {
  return <nav className={className} aria-label="Разделы кампании">{CAMPAIGN_SECTIONS.map((item) => {
    const active = item.id === section || (item.id === 'session' && SESSION_MODES.has(section))
    return <Link key={item.id} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} to={`/local/campaign/${campaignId}/${item.id}`}><Icon name={item.icon} size={16} /> {item.label}</Link>
  })}</nav>
}

export function CampaignHeader({ campaign, section }: { campaign: LocalCampaignRecord; section: string }) {
  return <header className="local-dashboard-header"><div className="local-dashboard-header__utility"><Link to="/"><Icon name="arrow-left" size={16} /> Кампании</Link><strong>{campaign.name}</strong><div className="row"><Badge tone="neutral" dot>Локальные данные</Badge><LocalThemeControl /></div></div><CampaignNav className="local-dashboard-nav" campaignId={campaign.id} section={section} /></header>
}

export function SaveErrorBanner({ message, retry }: { message: string | null; retry: () => void }) {
  if (!message) return null
  return <div className="campaign-workspace__recovery local-save-error" role="alert"><Icon name="triangle-alert" size={18} /><span><strong>Изменения не сохранены.</strong> {message}. Они остаются на экране — попробуйте ещё раз.</span><Button size="sm" onClick={retry}>Повторить</Button></div>
}

export function Editor({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="campaign-workspace__scrim" onMouseDown={(e) => { if (e.currentTarget === e.target) close() }} onKeyDown={(e) => { if (e.key === 'Escape') close() }}><section className="campaign-workspace__modal" role="dialog" aria-modal="true" aria-label={title}><span className="panel-kicker">Локальные параметры</span><h2>{title}</h2>{children}</section></div>
}

export function Capture({ value, setValue, add, label = 'Добавить' }: { value: string; setValue: (value: string) => void; add: () => void; label?: string }) {
  return <div className="new-campaign-room__capture"><input value={value} aria-label="Новая опорная точка" placeholder="Добавить опорную точку…" onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} /><Button icon={label === 'Добавить' ? 'plus' : 'check'} disabled={!value.trim()} onClick={add}>{label}</Button></div>
}

export const ENTITY_TYPES: Array<{ value: LocalCampaignEntityType; label: string }> = [
  ['character', 'Персонаж'], ['npc', 'Персонаж ведущего'], ['creature', 'Существо'], ['location', 'Локация'], ['faction', 'Фракция'], ['rumor', 'Слух'], ['item', 'Предмет'], ['audience', 'Аудитория'], ['note', 'Заметка'], ['letter', 'Письмо'], ['handout', 'Раздаточный материал'], ['map', 'Карта'], ['home-rule', 'Домашнее правило'],
].map(([value, label]) => ({ value: value as LocalCampaignEntityType, label }))
export const ENTITY_LABEL = Object.fromEntries(ENTITY_TYPES.map((item) => [item.value, item.label])) as Record<LocalCampaignEntityType, string>
