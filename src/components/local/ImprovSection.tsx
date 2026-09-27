import { useState } from 'react'
import { Badge, Button, EmptyState, Select } from '../../ds'
import { useActing } from '../../local/actingContext'
import { applyImprov, IMPROV_KIND, improvOf, newImprov } from '../../local/personal'
import type { LocalImprovKind } from '../../local/types'
import type { SectionProps } from './shared'
import { removeWithUndo } from '../toast'

/** The acting master's personal improv sheet. */
export function ImprovSection({ campaign, persist }: SectionProps) {
  const acting = useActing(campaign)
  const [kind, setKind] = useState<LocalImprovKind>('name')
  const [text, setText] = useState('')
  const items = improvOf(campaign, acting.master.id)
  const ready = items.filter((item) => !item.usedAt)
  const used = items.filter((item) => item.usedAt)
  const add = () => { if (!text.trim()) return; persist({ ...campaign, improv: [...campaign.improv, newImprov(acting.master.id, kind, text)] }); setText('') }
  const sessionTitle = (id?: string) => { const session = campaign.sessionRecords.find((item) => item.id === id); return session ? `сессия №${session.number}` : 'вне сессии' }

  return <section className="campaign-section improv-section">
    <div className="panel-heading"><div><span className="panel-kicker">Личный лист · {acting.master.name}</span><h2>Заготовки для импровизации</h2><p>Имена, NPC, места и осложнения на случай, когда игроки уходят с плана. Во время игры они под рукой в живой панели.</p></div></div>
    <div className="control-capture"><Select aria-label="Вид заготовки" value={kind} onChange={(e) => setKind(e.target.value as LocalImprovKind)}>{Object.entries(IMPROV_KIND).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><input aria-label="Текст заготовки" value={text} placeholder="Мирта Солеварка, торгует слухами…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} /><Button variant="primary" icon="plus" disabled={!text.trim()} onClick={add}>Добавить</Button></div>
    {ready.length ? <div className="improv-grid" aria-label="Наготове">{Object.entries(IMPROV_KIND).map(([value, label]) => { const list = ready.filter((item) => item.kind === value); return list.length ? <section key={value}><h3>{label}</h3><ul>{list.map((item) => <li key={item.id}><span>{item.text}</span><div className="row"><Button size="sm" onClick={() => persist(applyImprov(campaign, item.id, new Date().toISOString()))}>{item.kind === 'npc' || item.kind === 'location' || item.kind === 'item' ? 'В библиотеку' : 'Отметить'}</Button><Button size="sm" tone="danger" icon="trash-2" aria-label={`Удалить заготовку ${item.text}`} onClick={() => removeWithUndo(persist, campaign, { ...campaign, improv: campaign.improv.filter((entry) => entry.id !== item.id) }, `Заготовка «${item.text}»`)} /></div></li>)}</ul></section> : null })}</div> : <EmptyState icon="dices" title="Заготовок пока нет" hint="Запишите пару имён и осложнений заранее — пригодятся, когда история свернёт в сторону." />}
    {used.length > 0 && <details className="improv-used"><summary>Использовано · {used.length}</summary><ul>{used.map((item) => <li key={item.id}><Badge size="sm" tone="neutral">{IMPROV_KIND[item.kind]}</Badge> {item.text} <small>— {sessionTitle(item.usedSessionId)}{item.entityId ? ', в библиотеке' : ''}</small></li>)}</ul></details>}
  </section>
}
