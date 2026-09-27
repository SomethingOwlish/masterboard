import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge, Button, EmptyState, Icon } from '../ds'
import { LocalThemeControl } from '../components/LocalThemeControl'
import { useConfirm } from '../components/useConfirm'
import { WEEKDAYS, charactersByCampaign, newProfile, type PlayerEntry, type PlayerProfile } from '../local/players'
import type { LocalCampaignRecord } from '../local/types'
import { usePlayerDirectory } from '../local/usePlayerDirectory'
import { useLocalCatalog } from '../local/useLocalCampaign'

/**
 * Игроки (ТЗ-2, R11): один справочник для всех мастеров. Профиль — общий;
 * «Моя заметка» видна только её автору. Персонажи по кампаниям собираются из
 * кампаний, которые может открыть этот мастер.
 */
export function PlayersPage() {
  const catalog = useLocalCatalog()
  const shared = catalog.shared
  const directory = usePlayerDirectory()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [campaigns, setCampaigns] = useState<LocalCampaignRecord[]>([])
  const [draft, setDraft] = useState<{ profile: PlayerProfile; revision: number } | null>(null)
  useEffect(() => { void catalog.load().then((result) => setCampaigns(result.campaigns)) }, [catalog])
  const entries = directory.state.status === 'ready' ? directory.state.entries : []
  const openId = params.get('open')
  const open = entries.find((entry) => entry.profile.id === openId) ?? null
  useEffect(() => { setDraft(open ? { profile: structuredClone(open.profile), revision: open.revision } : null) }, [open?.profile.id, open?.revision]) // eslint-disable-line react-hooks/exhaustive-deps
  const visible = entries.filter((entry) => !query.trim() || `${entry.profile.name} ${entry.profile.contacts} ${entry.profile.preferences}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const create = async () => { const profile = newProfile(query.trim() || 'Новый игрок'); const entry = await directory.save(profile, 0); if (entry) { setQuery(''); setParams({ open: entry.profile.id }) } }
  return <main className="campaign-workspace">
    <header className="campaign-workspace__topbar"><div className="campaign-workspace__brand"><span>М</span><strong>Мастерборд</strong></div><div>{shared ? <Badge tone="accent" dot>{shared.email}</Badge> : <Badge tone="neutral" dot>Локальные данные</Badge>}<LocalThemeControl /></div></header>
    <section className="campaign-workspace__hero"><div><Link className="backups__back" to="/"><Icon name="arrow-left" size={15} /> Кампании</Link><span className="panel-kicker">Рабочее пространство ведущего</span><h1>Игроки</h1><p>Общий справочник для всех мастеров. Личная заметка видна только вам.</p></div></section>
    {directory.state.status === 'error' && <div className="campaign-workspace__recovery" role="alert"><Icon name="cloud-off" size={18} /><span><strong>Справочник недоступен.</strong> {directory.state.message}</span></div>}
    {directory.notice && <div className="campaign-workspace__recovery" role="status"><Icon name="git-merge" size={18} /><span>{directory.notice}</span></div>}
    <div className="players-page">
      <aside className="players-page__list" aria-label="Список игроков">
        <div className="players-page__search"><Icon name="search" size={16} /><input aria-label="Найти игрока" value={query} placeholder="Имя, контакт…" onChange={(event) => setQuery(event.target.value)} /></div>
        <Button variant="primary" icon="plus" block onClick={() => void create()}>{query.trim() ? `Добавить «${query.trim()}»` : 'Новый игрок'}</Button>
        {directory.state.status === 'loading' ? <p className="muted">Загружаем…</p> : visible.length ? <ul>{visible.map((entry) => <li key={entry.profile.id}><button type="button" className={entry.profile.id === openId ? 'active' : ''} onClick={() => setParams({ open: entry.profile.id })}><strong>{entry.profile.name || 'Без имени'}</strong><small>{charactersByCampaign(campaigns, entry.profile.id).map((item) => item.campaign).join(', ') || 'ни в одной кампании'}</small></button></li>)}</ul> : <p className="muted">{entries.length ? 'Никого не нашли.' : 'Справочник пуст.'}</p>}
      </aside>
      {draft && open ? <ProfileEditor key={open.profile.id} entry={open} draft={draft} setDraft={setDraft} campaigns={campaigns} directory={directory} close={() => setParams({})} /> : <EmptyState icon="users" title="Выберите игрока" hint="Или добавьте нового — профиль сразу увидят все мастера." />}
    </div>
  </main>
}

function ProfileEditor({ entry, draft, setDraft, campaigns, directory, close }: { entry: PlayerEntry; draft: { profile: PlayerProfile; revision: number }; setDraft: (next: { profile: PlayerProfile; revision: number }) => void; campaigns: LocalCampaignRecord[]; directory: ReturnType<typeof usePlayerDirectory>; close: () => void }) {
  const confirm = useConfirm()
  const [note, setNote] = useState(entry.myNote)
  const profile = draft.profile
  const set = (patch: Partial<PlayerProfile>) => setDraft({ ...draft, profile: { ...profile, ...patch } })
  const dirty = JSON.stringify(profile) !== JSON.stringify(entry.profile)
  const played = charactersByCampaign(campaigns, profile.id)
  const field = (key: 'contacts' | 'preferences' | 'limits' | 'notes', label: string, hint: string) => <label htmlFor={`player-${key}`}>{label}<textarea className="auto-grow" id={`player-${key}`} rows={2} value={profile[key]} placeholder={hint} onChange={(event) => set({ [key]: event.target.value })} /></label>
  return <section className="players-page__profile campaign-section" aria-label={`Профиль: ${entry.profile.name}`}>
    <div className="section-bar"><label htmlFor="player-name" className="players-page__name"><span className="sr-only">Имя</span><input id="player-name" value={profile.name} onChange={(event) => set({ name: event.target.value })} /></label><div className="row"><Button tone="danger" icon="trash-2" onClick={() => confirm({ title: `Удалить профиль «${entry.profile.name}»?`, message: 'Профиль исчезнет у всех мастеров. Игроки в кампаниях останутся, но без связи со справочником.', confirmLabel: 'Удалить', cancelLabel: 'Отмена', tone: 'danger', onConfirm: () => { void directory.remove(entry.profile.id).then(close) } })}>Удалить</Button><Button variant="primary" icon="check" disabled={!dirty || !profile.name.trim()} onClick={() => void directory.save(profile, draft.revision)}>Сохранить</Button></div></div>
    <div className="players-page__grid">
      {field('contacts', 'Контакты', 'Телеграм, телефон, почта')}
      {field('preferences', 'Предпочтения в игре', 'Интриги, бои, исследование…')}
      {field('limits', 'Табу и границы', 'Темы, которых не касаемся, и что только за кадром')}
      <fieldset className="players-page__days"><legend>Доступность по дням</legend><div className="row">{WEEKDAYS.map((day) => { const on = profile.availability.days.includes(day); return <label key={day} className={`home-chip${on ? ' on' : ''}`}><input type="checkbox" checked={on} onChange={() => set({ availability: { ...profile.availability, days: on ? profile.availability.days.filter((item) => item !== day) : [...profile.availability.days, day] } })} />{day}</label> })}</div><input aria-label="Когда удобно" value={profile.availability.note} placeholder="Вечером после 19, раз в две недели" onChange={(event) => set({ availability: { ...profile.availability, note: event.target.value } })} /></fieldset>
      {field('notes', 'Заметки мастеров', 'Видят все мастера')}
      <label htmlFor="player-my-note" className="players-page__mine">Моя заметка <small>— видна только вам</small><textarea className="auto-grow" id="player-my-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} /><Button size="sm" disabled={note === entry.myNote} onClick={() => void directory.note(entry.profile.id, note)}>Сохранить заметку</Button></label>
    </div>
    <h3>Персонажи по кампаниям</h3>
    {played.length ? <ul className="players-page__played">{played.map((item) => <li key={item.campaignId}><Link to={`/local/campaign/${item.campaignId}/team`}>{item.campaign}</Link>: {item.characters.join(', ') || <span className="muted">персонаж не указан</span>}</li>)}</ul> : <p className="muted">Не играет ни в одной из ваших кампаний. Добавить можно в кампании: «Команда» → «Из справочника».</p>}
    {entry.updatedBy && <small className="muted">Последним правил: {entry.updatedBy}</small>}
  </section>
}
