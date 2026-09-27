import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, EmptyState } from '../../ds'
import { useActing } from '../../local/actingContext'
import { newGroup, newMaster, newPlayer, ownerOf, playerCharacters, removeGroup, removeMaster, removePlayer, transferOwnership } from '../../local/team'
import type { LocalGroup, LocalPlayer } from '../../local/types'
import { useLocalCatalog } from '../../local/useLocalCampaign'
import { useConfirm } from '../useConfirm'
import { Checklist, Editor, type SectionProps } from './shared'
import { PeekLink, PeekList } from './Peek'

export function TeamSection({ campaign, persist }: SectionProps) {
  const acting = useActing(campaign)
  const confirm = useConfirm()
  const catalog = useLocalCatalog()
  const navigate = useNavigate()
  const [masterName, setMasterName] = useState('')
  const [masterEmail, setMasterEmail] = useState('')
  const shared = catalog.shared?.isShared(campaign.id) ?? false
  const [playerEditor, setPlayerEditor] = useState<LocalPlayer | null>(null)
  const [groupEditor, setGroupEditor] = useState<LocalGroup | null>(null)
  const owner = ownerOf(campaign)
  const characters = campaign.entities.filter((entity) => entity.type === 'character' && entity.status !== 'archived')
  const lockedHint = `Только владелец кампании (${owner.name}) может это менять.`

  const emailOk = (value: string) => !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  const addMaster = () => {
    if (!masterName.trim() || !acting.canManage || !emailOk(masterEmail)) return
    const email = masterEmail.trim().toLowerCase()
    persist({ ...campaign, masters: [...campaign.masters, { ...newMaster(masterName), ...(email ? { email } : {}) }] })
    setMasterName(''); setMasterEmail('')
  }
  const setEmail = (id: string, value: string) => {
    if (!emailOk(value)) return
    const email = value.trim().toLowerCase()
    persist({ ...campaign, masters: campaign.masters.map((master) => master.id === id ? { ...master, email: email || undefined } : master) })
  }
  const savePlayer = () => { if (!playerEditor?.name.trim()) return; const player = { ...playerEditor, name: playerEditor.name.trim(), note: playerEditor.note.trim() }; persist({ ...campaign, players: campaign.players.some((item) => item.id === player.id) ? campaign.players.map((item) => item.id === player.id ? player : item) : [...campaign.players, player] }); setPlayerEditor(null) }
  const saveGroup = () => { if (!groupEditor?.name.trim()) return; const group = { ...groupEditor, name: groupEditor.name.trim() }; persist({ ...campaign, groups: campaign.groups.some((item) => item.id === group.id) ? campaign.groups.map((item) => item.id === group.id ? group : item) : [...campaign.groups, group] }); setGroupEditor(null) }
  const archive = () => confirm({ title: campaign.archived ? 'Вернуть кампанию из архива?' : 'Отправить кампанию в архив?', message: campaign.archived ? 'Кампания снова появится в общем списке.' : 'Кампания уйдёт в раздел «Архив» на главной. Данные сохранятся.', confirmLabel: campaign.archived ? 'Вернуть' : 'В архив', cancelLabel: 'Отмена', tone: 'accent', onConfirm: () => persist({ ...campaign, archived: !campaign.archived }) })
  const remove = () => confirm({ title: `Удалить «${campaign.name}»?`, message: shared ? 'Кампания и все её сессии будут удалены с сервера у всех мастеров. Если нужна копия, сначала сделайте экспорт на Обзоре.' : 'Кампания и все её сессии будут удалены из этого браузера. Если нужна копия, сначала сделайте экспорт на Обзоре.', confirmLabel: 'Удалить навсегда', cancelLabel: 'Отмена', onConfirm: () => { void catalog.remove(campaign.id).then(() => navigate('/')) } })

  return <section className="campaign-section team-section">
    <div className="panel-heading"><div><span className="panel-kicker">Кто играет и кто ведёт</span><h2>Команда кампании</h2><p>Мастера с ролями, общий пул игроков и группы, для которых проводятся сессии.</p></div></div>

    <section className="team-section__block" aria-label="Мастера">
      <header><h3>Мастера</h3><p className="muted">Владелец управляет составом мастеров, архивом и удалением. Запускать, закрывать и разбирать сессию может её ответственный мастер или владелец.{shared && ' Кампания общая: мастер входит по своей почте и видит её у себя.'}</p></header>
      <ul className="team-section__list">{campaign.masters.map((master) => <li key={master.id}><div className="row team-section__master"><strong>{master.name}</strong><Badge size="sm" tone={master.role === 'owner' ? 'accent' : 'neutral'}>{master.role === 'owner' ? 'Владелец' : 'Со-мастер'}</Badge>{master.id === acting.master.id && <Badge size="sm" tone="success">это вы</Badge>}{!shared && master.email && <small>{master.email}</small>}</div>{shared && (acting.canManage && master.role !== 'owner' ? <input className="team-section__email" type="email" aria-label={`Почта мастера ${master.name}`} placeholder="почта для входа" defaultValue={master.email ?? ''} onBlur={(e) => { if (e.target.value.trim().toLowerCase() !== (master.email ?? '')) setEmail(master.id, e.target.value) }} /> : <small>{master.email ?? 'почта не указана'}</small>)}{acting.canManage && master.role !== 'owner' && <div className="row"><Button size="sm" onClick={() => confirm({ title: `Передать владение ${master.name}?`, message: 'Вы останетесь со-мастером и потеряете права владельца.', confirmLabel: 'Передать', cancelLabel: 'Отмена', tone: 'accent', onConfirm: () => persist(transferOwnership(campaign, master.id)) })}>Сделать владельцем</Button><Button size="sm" tone="danger" icon="trash-2" aria-label={`Убрать мастера ${master.name}`} onClick={() => confirm({ title: `Убрать ${master.name} из мастеров?`, message: 'Сессии, за которые он отвечал, перейдут владельцу.', confirmLabel: 'Убрать', cancelLabel: 'Отмена', onConfirm: () => persist(removeMaster(campaign, master.id)) })} /></div>}</li>)}</ul>
      {acting.canManage ? <div className="control-capture"><input aria-label="Имя нового мастера" value={masterName} placeholder="Имя со-мастера" onChange={(e) => setMasterName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addMaster() }} />{shared && <input type="email" aria-label="Почта нового мастера" value={masterEmail} placeholder="Почта для входа" onChange={(e) => setMasterEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addMaster() }} />}<Button icon="plus" disabled={!masterName.trim() || !emailOk(masterEmail) || (shared && !masterEmail.trim())} onClick={addMaster}>Добавить мастера</Button></div> : <p className="muted" role="note">{lockedHint}</p>}
    </section>

    <section className="team-section__block" aria-label="Игроки">
      <header className="row"><h3>Игроки</h3><Button size="sm" icon="plus" onClick={() => setPlayerEditor(newPlayer(''))}>Новый игрок</Button></header>
      {campaign.players.length ? <ul className="team-section__list">{campaign.players.map((player) => { const groups = campaign.groups.filter((group) => group.playerIds.includes(player.id)); const heroes = playerCharacters(campaign, player); return <li key={player.id}><div><strong><PeekLink target={{ kind: 'player', id: player.id }}>{player.name}</PeekLink></strong><small>{groups.map((group) => group.name).join(', ') || 'без группы'}{heroes.length > 0 && <> · играет: <PeekList items={heroes.map((hero) => ({ target: { kind: 'entity', id: hero.id }, name: hero.name }))} /></>}</small>{player.note && <small>{player.note}</small>}</div><div className="row"><Button size="sm" icon="pencil" aria-label={`Редактировать игрока ${player.name}`} onClick={() => setPlayerEditor(structuredClone(player))} /><Button size="sm" tone="danger" icon="trash-2" aria-label={`Удалить игрока ${player.name}`} onClick={() => confirm({ title: `Удалить игрока ${player.name}?`, message: 'Игрок исчезнет из групп, приглашений и получателей секретов.', confirmLabel: 'Удалить', cancelLabel: 'Отмена', onConfirm: () => persist(removePlayer(campaign, player.id)) })} /></div></li> })}</ul> : <EmptyState icon="users" title="Игроков пока нет" hint="Добавьте игроков, чтобы собирать группы и выбирать, кому раскрыт секрет." />}
    </section>

    <section className="team-section__block" aria-label="Группы">
      <header className="row"><h3>Группы</h3><Button size="sm" icon="plus" disabled={!campaign.players.length} onClick={() => setGroupEditor(newGroup(''))}>Новая группа</Button></header>
      {campaign.groups.length ? <ul className="team-section__list">{campaign.groups.map((group) => <li key={group.id}><div><strong>{group.name}</strong><small><PeekList empty="без участников" items={group.playerIds.flatMap((id) => { const player = campaign.players.find((item) => item.id === id); return player ? [{ target: { kind: 'player' as const, id }, name: player.name }] : [] })} /></small></div><div className="row"><Button size="sm" icon="pencil" aria-label={`Редактировать группу ${group.name}`} onClick={() => setGroupEditor(structuredClone(group))} /><Button size="sm" tone="danger" icon="trash-2" aria-label={`Удалить группу ${group.name}`} onClick={() => persist(removeGroup(campaign, group.id))} /></div></li>)}</ul> : <p className="muted">Групп пока нет. Сессия проводится для группы; игроков из других групп можно пригласить в паспорте сессии.</p>}
    </section>

    <section className="team-section__block team-section__danger" aria-label="Управление кампанией">
      <header><h3>Управление кампанией</h3></header>
      {acting.canManage ? <div className="row"><Button onClick={archive}>{campaign.archived ? 'Вернуть из архива' : 'В архив'}</Button><Button tone="danger" icon="trash-2" onClick={remove}>Удалить кампанию</Button></div> : <p className="muted" role="note">{lockedHint}</p>}
    </section>

    {playerEditor && <Editor title={campaign.players.some((item) => item.id === playerEditor.id) ? 'Игрок' : 'Новый игрок'} close={() => setPlayerEditor(null)}>
      <label htmlFor="player-name">Имя<input id="player-name" autoFocus value={playerEditor.name} onChange={(e) => setPlayerEditor({ ...playerEditor, name: e.target.value })} /></label>
      <Checklist legend="Персонажи игрока" options={characters.map((entity) => ({ id: entity.id, label: entity.name }))} value={playerEditor.characterIds} onChange={(characterIds) => setPlayerEditor({ ...playerEditor, characterIds })} empty="В библиотеке нет сущностей типа «Персонаж»." />
      <label htmlFor="player-note">Заметка<input id="player-note" value={playerEditor.note} onChange={(e) => setPlayerEditor({ ...playerEditor, note: e.target.value })} /></label>
      <footer><Button onClick={() => setPlayerEditor(null)}>Отмена</Button><Button variant="primary" icon="check" disabled={!playerEditor.name.trim()} onClick={savePlayer}>Сохранить</Button></footer>
    </Editor>}
    {groupEditor && <Editor title={campaign.groups.some((item) => item.id === groupEditor.id) ? 'Группа' : 'Новая группа'} close={() => setGroupEditor(null)}>
      <label htmlFor="group-name">Название<input id="group-name" autoFocus value={groupEditor.name} onChange={(e) => setGroupEditor({ ...groupEditor, name: e.target.value })} /></label>
      <Checklist legend="Участники" options={campaign.players.map((player) => ({ id: player.id, label: player.name }))} value={groupEditor.playerIds} onChange={(playerIds) => setGroupEditor({ ...groupEditor, playerIds })} />
      <footer><Button onClick={() => setGroupEditor(null)}>Отмена</Button><Button variant="primary" icon="check" disabled={!groupEditor.name.trim()} onClick={saveGroup}>Сохранить</Button></footer>
    </Editor>}
  </section>
}
