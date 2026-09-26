import { useState } from 'react'
import { Button } from '../../ds'
import { Capture, type SectionProps } from './shared'

export function WorldSection({ campaign, persist }: SectionProps) {
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const add = () => { const text = note.trim(); if (!text) return; persist({ ...campaign, notes: [...campaign.notes, text] }); setNote('') }
  const save = () => { if (editing === null || !note.trim()) return; const notes = [...campaign.notes]; notes[editing] = note.trim(); persist({ ...campaign, notes }); setNote(''); setEditing(null) }
  const remove = (index: number) => persist({ ...campaign, notes: campaign.notes.filter((_, noteIndex) => noteIndex !== index) })
  return <section className="campaign-section"><div className="panel-heading"><div><span className="panel-kicker">Контекст для подготовки</span><h2>Мир кампании</h2><p>Факты, места и персонажи, на которые можно опираться во время игры.</p></div><span className="panel-state">{campaign.notes.length}</span></div><ol className="campaign-world-list">{campaign.notes.map((item, index) => <li key={`${item}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p><div><Button icon="pencil" aria-label={`Редактировать: ${item}`} onClick={() => { setEditing(index); setNote(item) }} /><Button icon="trash-2" aria-label={`Удалить: ${item}`} onClick={() => remove(index)} /></div></li>)}</ol><Capture value={note} setValue={setNote} add={editing === null ? add : save} label={editing === null ? 'Добавить' : 'Сохранить'} />{editing !== null && <Button onClick={() => { setEditing(null); setNote('') }}>Отменить редактирование</Button>}</section>
}
