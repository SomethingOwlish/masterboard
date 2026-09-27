import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Icon } from '../../ds'
import { LocalThemeControl } from '../LocalThemeControl'
import { ActingMasterSelect } from './ActingMasterSelect'
import { useLocalCatalog } from '../../local/useLocalCampaign'
import type { CampaignConflicts } from '../../local/useLocalCampaign'
import { conflictPlace, conflictValue } from '../../local/merge'
import type { LocalCampaignEntityType, LocalCampaignRecord } from '../../local/types'
import { searchShortcut, usePeek } from '../../local/peekContext'
import { plural } from '../../local/labels'

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
  { id: 'improv', label: 'Заготовки', icon: 'dices' },
  { id: 'team', label: 'Команда', icon: 'users' },
  { id: 'import', label: 'Импорт', icon: 'import' },
  { id: 'integrations', label: 'Интеграции', icon: 'plug' },
  { id: 'publish', label: 'Публикация', icon: 'upload' },
  { id: 'print', label: 'Печать', icon: 'printer' },
] as const
type SectionId = typeof CAMPAIGN_SECTIONS[number]['id']

/** Menu groups (ТЗ-2, R4): a group with one section is a plain link. */
export const NAV_GROUPS = [
  { id: 'prep', label: 'Подготовка', sections: ['overview', 'session', 'arcs', 'control'] },
  { id: 'world', label: 'Мир', sections: ['library', 'map', 'world', 'improv'] },
  { id: 'team', label: 'Команда', sections: ['team'] },
  { id: 'exchange', label: 'Обмен', sections: ['import', 'integrations', 'publish', 'print'] },
] as const satisfies ReadonlyArray<{ id: string; label: string; sections: readonly SectionId[] }>

/** Every `section` route value the campaign page understands. */
export const KNOWN_SECTIONS = new Set<string>([...CAMPAIGN_SECTIONS.map((item) => item.id), 'play', 'review', 'entity'])

const SESSION_MODES = new Set(['session', 'play', 'review'])
const sectionOf = (id: string) => CAMPAIGN_SECTIONS.find((item) => item.id === id)!

/**
 * Campaign menu (ТЗ-2, R4 C): groups open a list of their sections; the active
 * group shows which section is open. Plus the campaign search (Ctrl+K).
 */
export function CampaignNav({ campaignId, section, className }: { campaignId: string; section: string; className?: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const peek = usePeek()
  const current = SESSION_MODES.has(section) ? 'session' : section === 'entity' ? 'library' : section
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest?.('.campaign-nav__group')) setOpen(null) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(null) }
    window.addEventListener('mousedown', onDown); window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])
  const link = (id: SectionId, onClick?: () => void) => { const item = sectionOf(id); const active = id === current; return <Link key={id} role={onClick ? 'menuitem' : undefined} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} to={`/local/campaign/${campaignId}/${id}`} onClick={onClick}><Icon name={item.icon} size={16} /> {item.label}</Link> }
  return <nav className={`campaign-nav${className ? ` ${className}` : ''}`} aria-label="Разделы кампании">
    {NAV_GROUPS.map((group) => {
      if (group.sections.length === 1) return <div key={group.id} className={`campaign-nav__group campaign-nav__group--single${group.sections[0] === current ? ' active' : ''}`}>{link(group.sections[0])}</div>
      const active = (group.sections as readonly string[]).includes(current)
      const expanded = open === group.id
      return <div key={group.id} className={`campaign-nav__group${active ? ' active' : ''}`}>
        <button type="button" aria-haspopup="menu" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : group.id)}>{group.label}{active && <span className="campaign-nav__current">{sectionOf(current).label}</span>}<Icon name="chevron-down" size={14} /></button>
        {expanded && <div className="campaign-nav__menu" role="menu" aria-label={group.label}>{group.sections.map((id) => link(id, () => setOpen(null)))}</div>}
      </div>
    })}
    {peek && <button type="button" className="campaign-nav__search" onClick={peek.search} aria-label="Поиск по кампании"><Icon name="search" size={15} /> Поиск <kbd>{searchShortcut()}</kbd></button>}
  </nav>
}

export function CampaignHeader({ campaign, section }: { campaign: LocalCampaignRecord; section: string }) {
  return <header className="local-dashboard-header campaign-topbar"><Link className="campaign-topbar__back" to="/" aria-label="Все кампании"><Icon name="arrow-left" size={16} /> <span>Кампании</span></Link><strong className="campaign-topbar__name">{campaign.name}</strong><CampaignNav campaignId={campaign.id} section={section} /><div className="row campaign-topbar__tools"><ActingMasterSelect campaign={campaign} /><StorageIcon campaignId={campaign.id} /><LocalThemeControl /></div></header>
}

/** The same as `StorageBadge`, as an icon for the compact campaign bar. */
function StorageIcon({ campaignId }: { campaignId: string }) {
  const { shared } = useLocalCatalog()
  const label = shared?.isShared(campaignId) ? 'Общая кампания' : 'Локальные данные'
  return <span className="campaign-topbar__storage" title={label}><Icon name={shared?.isShared(campaignId) ? 'cloud' : 'hard-drive'} size={16} /><span className="sr-only">{label}</span></span>
}

/** Where this campaign lives: on the shared server or only in this browser. */
export function StorageBadge({ campaignId }: { campaignId: string }) {
  const { shared } = useLocalCatalog()
  return shared?.isShared(campaignId) ? <Badge tone="accent" dot>Общая кампания</Badge> : <Badge tone="neutral" dot>Локальные данные</Badge>
}

export function SaveErrorBanner({ message, retry, savedInBrowser = false }: { message: string | null; retry: () => void; savedInBrowser?: boolean }) {
  if (!message) return null
  return savedInBrowser
    ? <div className="campaign-workspace__recovery local-save-error" role="alert"><Icon name="cloud-off" size={18} /><span><strong>Нет связи с сервером.</strong> Правки сохранены в этом браузере и отправятся, когда связь вернётся. ({message})</span><Button size="sm" icon="refresh-cw" onClick={retry}>Синхронизировать</Button></div>
    : <div className="campaign-workspace__recovery local-save-error" role="alert"><Icon name="triangle-alert" size={18} /><span><strong>Изменения не сохранены.</strong> {message}. Они остаются на экране — попробуйте ещё раз.</span><Button size="sm" onClick={retry}>Повторить</Button></div>
}

/** Who wrote the kept version, by name when they are on the campaign. */
const otherMaster = (campaign: LocalCampaignRecord, email?: string) => {
  const name = (email && campaign.masters.find((master) => master.email?.toLocaleLowerCase() === email.toLocaleLowerCase())?.name) || email
  return name ? { who: `мастер ${name}`, whose: `мастера ${name}`, label: name } : { who: 'другой мастер', whose: 'другого мастера', label: 'Другой мастер' }
}

/**
 * Both masters changed the same thing in a shared campaign (decision I4): the
 * other master's version is on screen, and the master picks «моя» or «их» per place.
 */
export function ConflictNotice({ campaign, conflicts, resolve }: { campaign: LocalCampaignRecord; conflicts: CampaignConflicts | null; resolve: (mine: string[]) => void }) {
  const [open, setOpen] = useState(false)
  if (!conflicts?.items.length) return null
  const them = otherMaster(campaign, conflicts.by)
  const count = conflicts.items.length
  return <>
    <div className="campaign-workspace__recovery" role="status"><Icon name="git-merge" size={18} /><span><strong>Правки объединены.</strong> Вы и {them.who} изменили одно и то же — {count} {plural(count, 'место', 'места', 'мест')}. Сейчас на экране версия {them.whose}.</span><Button size="sm" onClick={() => setOpen(true)}>Разобрать</Button></div>
    {open && <ConflictDialog campaign={campaign} conflicts={conflicts} them={them} resolve={(mine) => { setOpen(false); resolve(mine) }} close={() => setOpen(false)} />}
  </>
}

function ConflictDialog({ campaign, conflicts, them, resolve, close }: { campaign: LocalCampaignRecord; conflicts: CampaignConflicts; them: ReturnType<typeof otherMaster>; resolve: (mine: string[]) => void; close: () => void }) {
  const [mine, setMine] = useState<string[]>([])
  const pick = (path: string, value: boolean) => setMine(value ? [...mine.filter((item) => item !== path), path] : mine.filter((item) => item !== path))
  return <Editor kicker="Общая кампания" title={`Изменено у вас и у ${them.whose}`} close={close}>
    <p className="muted">Эти места вы и {them.who} поменяли одновременно. Выберите, что оставить; остальные правки уже объединены.</p>
    {conflicts.items.map((item) => <fieldset key={item.path} className="source-clash"><legend>{conflictPlace(campaign as unknown as Record<string, unknown>, item)}</legend>
      <label><input type="radio" name={item.path} checked={mine.includes(item.path)} onChange={() => pick(item.path, true)} /><span><small>Ваша</small>{conflictValue(item.mine, item.theirs)}</span></label>
      <label><input type="radio" name={item.path} checked={!mine.includes(item.path)} onChange={() => pick(item.path, false)} /><span><small>{them.label}</small>{conflictValue(item.theirs, item.mine)}</span></label>
    </fieldset>)}
    <footer><Button onClick={() => resolve([])}>Оставить версию {them.whose}</Button><Button variant="primary" icon="check" onClick={() => resolve(mine)}>Применить</Button></footer>
  </Editor>
}

export function Editor({ title, close, children, kicker = 'Локальные параметры' }: { title: string; close: () => void; children: ReactNode; kicker?: string }) {
  return <div className="campaign-workspace__scrim" onMouseDown={(e) => { if (e.currentTarget === e.target) close() }} onKeyDown={(e) => { if (e.key === 'Escape') close() }}><section className="campaign-workspace__modal" role="dialog" aria-modal="true" aria-label={title}><span className="panel-kicker">{kicker}</span><h2>{title}</h2>{children}</section></div>
}

/**
 * A text field that saves only on submit (Enter or «Сохранить»), not on every
 * keystroke; Escape puts the saved value back. Keeps writes to the server rare.
 */
export function SubmitField({ label, value, onSubmit, placeholder, className }: { label: string; value: string; onSubmit: (value: string) => void; placeholder?: string; className?: string }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const dirty = draft.trim() !== value.trim()
  return <form className={`submit-field${className ? ` ${className}` : ''}`} onSubmit={(event) => { event.preventDefault(); if (dirty) onSubmit(draft.trim()) }}>
    <input aria-label={label} value={draft} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setDraft(value) } }} />
    <Button type="submit" size="sm" icon="check" disabled={!dirty} aria-label={`Сохранить: ${label}`}>Сохранить</Button>
  </form>
}

/** Wide dialog of the sessions workspace (passport, library picker). Escape or a click outside closes it. */
export function SessionModal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="campaign-workspace__scrim" onMouseDown={(event) => { if (event.currentTarget === event.target) close() }} onKeyDown={(event) => { if (event.key === 'Escape') close() }}><section className="campaign-workspace__modal sessions-modal" role="dialog" aria-modal="true" aria-label={title}><h2>{title}</h2>{children}</section></div>
}

export function Capture({ value, setValue, add, label = 'Добавить' }: { value: string; setValue: (value: string) => void; add: () => void; label?: string }) {
  return <div className="new-campaign-room__capture"><input value={value} aria-label="Новая опорная точка" placeholder="Добавить опорную точку…" onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} /><Button icon={label === 'Добавить' ? 'plus' : 'check'} disabled={!value.trim()} onClick={add}>{label}</Button></div>
}

export const ENTITY_TYPES: Array<{ value: LocalCampaignEntityType; label: string }> = [
  ['character', 'Персонаж'], ['npc', 'Персонаж ведущего'], ['creature', 'Существо'], ['location', 'Локация'], ['faction', 'Фракция'], ['rumor', 'Слух'], ['item', 'Предмет'], ['audience', 'Аудитория'], ['note', 'Заметка'], ['letter', 'Письмо'], ['handout', 'Раздаточный материал'], ['map', 'Карта'], ['event', 'Событие'], ['lore', 'Лор / статья'], ['home-rule', 'Домашнее правило'],
].map(([value, label]) => ({ value: value as LocalCampaignEntityType, label }))
export const ENTITY_LABEL = Object.fromEntries(ENTITY_TYPES.map((item) => [item.value, item.label])) as Record<LocalCampaignEntityType, string>

/** Compact multi-select made of checkboxes, for linking records to each other. */
export function Checklist({ legend, options, value, onChange, empty }: { legend: string; options: Array<{ id: string; label: string }>; value: string[]; onChange: (next: string[]) => void; empty?: string }) {
  return <fieldset className="local-checklist"><legend>{legend}</legend>{options.length ? options.map((option) => <label key={option.id}><input type="checkbox" checked={value.includes(option.id)} onChange={() => onChange(value.includes(option.id) ? value.filter((id) => id !== option.id) : [...value, option.id])} /> {option.label}</label>) : <small>{empty ?? 'Пока нечего выбрать.'}</small>}</fieldset>
}
