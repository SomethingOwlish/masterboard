import { useState } from 'react'
import { Badge, Button, EmptyState } from '../../ds'
import { changeSecretStatus, newSecret, secretSessions, type RevealInput } from '../../local/domain'
import type { LocalCampaignSecret, LocalSecretStatus } from '../../local/types'
import { useConfirm } from '../useConfirm'
import { Checklist, Editor, type SectionProps } from './shared'

export const SECRET_STATUS: Record<LocalSecretStatus, string> = { hidden: 'Не раскрыт', partial: 'Частично', selected: 'Выбранным героям', everyone: 'Всем героям', disproved: 'Опровергнут', obsolete: 'Устарел' }
type Draft = Omit<LocalCampaignSecret, 'id' | 'reveals' | 'sessionIds'>

export function SecretsPanel({ campaign, persist }: SectionProps) {
  const confirm = useConfirm()
  const [editor, setEditor] = useState<LocalCampaignSecret | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(() => { const { id: _i, reveals: _r, sessionIds: _s, ...rest } = newSecret(); return rest })
  const [revealing, setRevealing] = useState<LocalCampaignSecret | null>(null)
  const [reveal, setReveal] = useState<RevealInput>({ status: 'partial', recipients: '', sessionId: '', note: '' })
  const openEditor = (secret: LocalCampaignSecret | 'new') => { setEditor(secret); const { id: _i, reveals: _r, sessionIds: _s, ...rest } = secret === 'new' ? newSecret() : secret; setDraft(rest) }
  const save = () => {
    if (!draft.title.trim() || !draft.truth.trim() || !editor) return
    const base = editor === 'new' ? newSecret() : editor
    const secret: LocalCampaignSecret = { ...base, ...draft, title: draft.title.trim(), truth: draft.truth.trim(), publicVersion: draft.publicVersion.trim(), recipients: draft.recipients.trim(), revealCondition: draft.revealCondition.trim(), status: editor === 'new' ? draft.status : base.status }
    persist({ ...campaign, secrets: editor === 'new' ? [...campaign.secrets, secret] : campaign.secrets.map((item) => item.id === secret.id ? secret : item) })
    setEditor(null)
  }
  const openReveal = (secret: LocalCampaignSecret) => { setRevealing(secret); setReveal({ status: secret.status === 'hidden' ? 'partial' : secret.status, recipients: secret.recipients, sessionId: campaign.sessionRecords.find((session) => session.status === 'active')?.id ?? '', note: '' }) }
  const saveReveal = () => {
    if (!revealing) return
    const next = changeSecretStatus(revealing, { ...reveal, recipients: reveal.recipients.trim() }, new Date().toISOString())
    persist({ ...campaign, secrets: campaign.secrets.map((item) => item.id === next.id ? next : item) })
    setRevealing(null)
  }
  const remove = (secret: LocalCampaignSecret) => confirm({ title: 'Удалить секрет?', message: 'Вернуть секрет после удаления не получится. Пункты плана, которые на него ссылаются, станут обычным текстом.', confirmLabel: 'Удалить', cancelLabel: 'Отмена', onConfirm: () => persist({
    ...campaign,
    secrets: campaign.secrets.filter((item) => item.id !== secret.id),
    clocks: campaign.clocks.map((clock) => ({ ...clock, secretIds: clock.secretIds.filter((id) => id !== secret.id) })),
    sessionRecords: campaign.sessionRecords.map((session) => ({ ...session, planItems: session.planItems.map((item) => item.secretId === secret.id ? { ...item, secretId: undefined, text: secret.title } : item) })),
  }) })
  const sessionName = (id?: string) => { const session = campaign.sessionRecords.find((item) => item.id === id); return session ? `№${session.number} ${session.title}` : 'вне сессии' }

  return <div className="control-panel"><header><div><h3>Секреты и знания</h3><p>Мастерская истина отделена от формулировки для игроков. Каждое раскрытие попадает в историю.</p></div><Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Новый секрет</Button></header>
    {campaign.secrets.length ? <div className="secret-list">{campaign.secrets.map((secret) => { const sessions = secretSessions(secret, campaign); const links = [...secret.entityIds.map((id) => campaign.entities.find((entity) => entity.id === id)?.name), ...secret.clockIds.map((id) => { const title = campaign.clocks.find((clock) => clock.id === id)?.title; return title && `Часы: ${title}` }), ...sessions.map((session) => `Сессия №${session.number}`)].filter(Boolean) as string[]; return <article key={secret.id} aria-label={`Секрет: ${secret.title}`}>
      <header><div><Badge tone={secret.status === 'hidden' ? 'warning' : secret.status === 'everyone' ? 'success' : 'neutral'}>{SECRET_STATUS[secret.status]}</Badge>{secret.recipients && <span>{secret.recipients}</span>}</div><div><Button size="sm" onClick={() => openReveal(secret)}>Раскрыть…</Button><Button size="sm" icon="pencil" aria-label={`Редактировать секрет: ${secret.title}`} onClick={() => openEditor(secret)} /><Button size="sm" tone="danger" icon="trash-2" aria-label={`Удалить секрет: ${secret.title}`} onClick={() => remove(secret)} /></div></header>
      <h4>{secret.title}</h4>
      <dl><div><dt>Мастерская истина</dt><dd>{secret.truth}</dd></div><div><dt>Для игроков</dt><dd>{secret.publicVersion || 'Публичная формулировка не подготовлена.'}</dd></div>{secret.revealCondition && <div><dt>Условие раскрытия</dt><dd>{secret.revealCondition}</dd></div>}</dl>
      {links.length > 0 && <div className="local-chips">{links.map((label) => <span key={label}>{label}</span>)}</div>}
      {secret.reveals.length > 0 && <details className="clock-history"><summary>История раскрытий · {secret.reveals.length}</summary><ol>{[...secret.reveals].reverse().map((entry) => <li key={entry.id}><strong>{SECRET_STATUS[entry.status]}</strong><span>{[entry.recipients, sessionName(entry.sessionId), entry.note].filter(Boolean).join(' · ')}</span><time>{new Date(entry.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></li>)}</ol></details>}
    </article> })}</div> : <EmptyState icon="shield" title="Секретов пока нет" hint="Зафиксируйте истину ведущего отдельно от того, что знают герои." action={<Button variant="primary" icon="plus" onClick={() => openEditor('new')}>Создать секрет</Button>} />}

    {revealing && <Editor title={`Раскрытие: ${revealing.title}`} close={() => setRevealing(null)}>
      <div className="control-form__row"><label htmlFor="reveal-status">Новое состояние<select id="reveal-status" value={reveal.status} onChange={(e) => setReveal({ ...reveal, status: e.target.value as LocalSecretStatus })}>{Object.entries(SECRET_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label htmlFor="reveal-recipients">Кому известно<input id="reveal-recipients" value={reveal.recipients} placeholder="Все, группа, имена героев" onChange={(e) => setReveal({ ...reveal, recipients: e.target.value })} /></label></div>
      <label htmlFor="reveal-session">В какой сессии<select id="reveal-session" value={reveal.sessionId} onChange={(e) => setReveal({ ...reveal, sessionId: e.target.value })}><option value="">Вне сессии</option>{campaign.sessionRecords.map((session) => <option key={session.id} value={session.id}>№{session.number} {session.title}</option>)}</select></label>
      <label htmlFor="reveal-note">Как это произошло<textarea id="reveal-note" rows={2} value={reveal.note} onChange={(e) => setReveal({ ...reveal, note: e.target.value })} /></label>
      <footer><Button onClick={() => setRevealing(null)}>Отмена</Button><Button variant="primary" icon="check" disabled={reveal.status === revealing.status && reveal.recipients.trim() === revealing.recipients} onClick={saveReveal}>Записать</Button></footer>
    </Editor>}

    {editor && <Editor title={editor === 'new' ? 'Новый секрет' : 'Редактировать секрет'} close={() => setEditor(null)}>
      <label htmlFor="secret-title">Название<input id="secret-title" autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
      <label htmlFor="secret-truth">Мастерская истина<textarea id="secret-truth" rows={3} value={draft.truth} onChange={(e) => setDraft({ ...draft, truth: e.target.value })} /></label>
      <label htmlFor="secret-public">Публичная формулировка<textarea id="secret-public" rows={2} value={draft.publicVersion} placeholder="То, что можно сообщить игрокам" onChange={(e) => setDraft({ ...draft, publicVersion: e.target.value })} /></label>
      <label htmlFor="secret-condition">Условие раскрытия<input id="secret-condition" value={draft.revealCondition} placeholder="Когда герои могут это узнать" onChange={(e) => setDraft({ ...draft, revealCondition: e.target.value })} /></label>
      {editor === 'new' && <div className="control-form__row"><label htmlFor="secret-status">Состояние<select id="secret-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as LocalSecretStatus })}>{Object.entries(SECRET_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label htmlFor="secret-recipients">Кому известно<input id="secret-recipients" value={draft.recipients} placeholder="Все, группа, имена героев" onChange={(e) => setDraft({ ...draft, recipients: e.target.value })} /></label></div>}
      <Checklist legend="Связанные сущности" options={campaign.entities.filter((entity) => entity.status !== 'archived').map((entity) => ({ id: entity.id, label: entity.name }))} value={draft.entityIds} onChange={(entityIds) => setDraft({ ...draft, entityIds })} empty="Библиотека пуста." />
      <Checklist legend="Связанные часы" options={campaign.clocks.map((clock) => ({ id: clock.id, label: clock.title }))} value={draft.clockIds} onChange={(clockIds) => setDraft({ ...draft, clockIds })} empty="Часов пока нет." />
      <footer><Button onClick={() => setEditor(null)}>Отмена</Button><Button variant="primary" icon="check" disabled={!draft.title.trim() || !draft.truth.trim()} onClick={save}>Сохранить</Button></footer>
    </Editor>}
  </div>
}
