import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../ds'
import { newPlayer } from '../../local/team'
import { usePlayerDirectory } from '../../local/usePlayerDirectory'
import { Editor, type SectionProps } from './shared'

/** «Из справочника» (ТЗ-2, R11): players from the shared directory join the campaign linked to their profile. */
export function DirectoryPicker({ campaign, persist, close }: SectionProps & { close: () => void }) {
  const directory = usePlayerDirectory()
  const [chosen, setChosen] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const present = new Set(campaign.players.map((player) => player.profileId).filter(Boolean))
  const entries = directory.state.status === 'ready' ? directory.state.entries.filter((entry) => !present.has(entry.profile.id)) : []
  const visible = entries.filter((entry) => !query.trim() || entry.profile.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const add = () => {
    const added = entries.filter((entry) => chosen.includes(entry.profile.id)).map((entry) => ({ ...newPlayer(entry.profile.name), profileId: entry.profile.id }))
    persist({ ...campaign, players: [...campaign.players, ...added] })
    close()
  }
  return <Editor kicker="Общий справочник" title="Игроки из справочника" close={close}>
    {directory.state.status === 'loading' && <p className="muted" role="status">Загружаем справочник…</p>}
    {directory.state.status === 'error' && <p className="local-session-error" role="alert">Справочник недоступен: {directory.state.message}</p>}
    {directory.state.status === 'ready' && (entries.length ? <>
      <label htmlFor="directory-query">Поиск<input id="directory-query" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <ul className="source-import__list" aria-label="Игроки справочника">{visible.map((entry) => <li key={entry.profile.id}><label><input type="checkbox" checked={chosen.includes(entry.profile.id)} onChange={() => setChosen(chosen.includes(entry.profile.id) ? chosen.filter((id) => id !== entry.profile.id) : [...chosen, entry.profile.id])} /><span className="source-import__text"><strong>{entry.profile.name}</strong>{(entry.profile.limits || entry.profile.preferences) && <small>{[entry.profile.preferences, entry.profile.limits && `табу: ${entry.profile.limits}`].filter(Boolean).join(' · ')}</small>}</span></label></li>)}</ul>
    </> : <p className="muted">В справочнике нет игроков, которых ещё нет в кампании. <Link to="/players">Открыть справочник</Link></p>)}
    <footer><Button onClick={close}>Отмена</Button><Button variant="primary" icon="plus" disabled={!chosen.length} onClick={add}>{chosen.length ? `Добавить ${chosen.length}` : 'Добавить'}</Button></footer>
  </Editor>
}
