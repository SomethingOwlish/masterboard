import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, Icon } from '../../ds'
import { downloadText } from '../../local/download'
import { importEntitiesFile, importTasks } from '../../local/imports'
import { ROLE_HINT, ROLE_LABEL, SYSTEM_LABEL, linkedRole, type CampaignRole } from '../../local/integration'
import { parseSessionImport, sessionImportTemplate, type SessionImportResult } from '../../local/sessionImport'
import { useActing } from '../../local/actingContext'
import { SessionImportDialog } from './SessionImportDialog'
import { ImportDialog } from './SourcePanels'
import type { SectionProps } from './shared'

const ROLES: CampaignRole[] = ['world', 'table', 'system']
const KIND_LABEL = { records: 'записей', sessions: 'сессий', file: 'сущностей' } as const
const date = (value: string) => new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * «Импорт» (ТЗ-2, R6): every way in, in one place — the linked world, table
 * and system, a sessions file, a file of entities; the history of imports and
 * what is left to sort out afterwards.
 */
export function ImportSection({ campaign, persist }: SectionProps) {
  const acting = useActing(campaign)
  const [source, setSource] = useState(false)
  const [sessions, setSessions] = useState<SessionImportResult | { error: string } | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const sessionsFile = useRef<HTMLInputElement>(null)
  const entitiesFile = useRef<HTMLInputElement>(null)
  const tasks = importTasks(campaign)
  const log = [...(campaign.importLog ?? [])].reverse()
  const readSessions = async (file?: File) => { if (!file) return; try { setSessions(parseSessionImport(await file.text(), campaign, acting.master.id, new Date().toISOString())) } catch (error) { setSessions({ error: error instanceof Error ? error.message : 'Не удалось прочитать файл' }) } }
  const readEntities = async (file?: File) => {
    if (!file) return
    try { const result = importEntitiesFile(campaign, await file.text(), new Date().toISOString()); persist(result.campaign); setMessage({ tone: 'ok', text: `Добавлено в библиотеку: ${result.added}.` }) } catch (error) { setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Не удалось прочитать файл' }) }
  }
  const linked = ROLES.map((role) => ({ role, linked: linkedRole(campaign, role) }))
  return <section className="campaign-section import-section">
    <div className="section-bar"><div><span className="panel-kicker">Обмен</span><h2>Импорт</h2></div><p className="muted">Всё, что приходит в кампанию извне. Кампанию целиком из файла — на странице <Link to="/import">«Импорт»</Link> рядом со списком кампаний.</p></div>
    <div className="import-tiles">
      {linked.map(({ role, linked: found }) => <article key={role} className="import-tile" aria-label={`Импорт: ${ROLE_LABEL[role]}`}>
        <header><Icon name={role === 'world' ? 'globe' : role === 'table' ? 'dices' : 'book-open'} size={18} /><strong>{ROLE_LABEL[role]}</strong></header>
        {found ? <><p>{SYSTEM_LABEL[found.system]} · {found.link.label}</p><Button size="sm" variant="primary" icon="download" onClick={() => setSource(true)}>Выбрать записи</Button></> : <><p className="muted">{ROLE_HINT[role]}. Не подключено.</p><Link className="import-tile__link" to={`/local/campaign/${campaign.id}/integrations`}>Подключить</Link></>}
      </article>)}
      <article className="import-tile" aria-label="Импорт: сессии из файла"><header><Icon name="clapperboard" size={18} /><strong>Сессии</strong></header><p className="muted">JSON по шаблону: сцены, пункты плана, переходы.</p><div className="row"><Button size="sm" icon="upload" onClick={() => sessionsFile.current?.click()}>Файл сессий</Button><Button size="sm" icon="download" onClick={() => downloadText('masterboard-sessions-template.json', sessionImportTemplate(campaign))}>Шаблон</Button></div></article>
      <article className="import-tile" aria-label="Импорт: сущности из файла"><header><Icon name="library" size={18} /><strong>Сущности</strong></header><p className="muted">Файл «Экспорта» из таблицы библиотеки другой кампании.</p><Button size="sm" icon="upload" onClick={() => entitiesFile.current?.click()}>Файл сущностей</Button></article>
    </div>
    <input ref={sessionsFile} type="file" accept="application/json,.json" hidden aria-label="Файл сессий" onChange={(event) => { void readSessions(event.target.files?.[0]); event.target.value = '' }} />
    <input ref={entitiesFile} type="file" accept="application/json,.json" hidden aria-label="Файл сущностей" onChange={(event) => { void readEntities(event.target.files?.[0]); event.target.value = '' }} />
    {message && <p className={message.tone === 'error' ? 'local-session-error' : 'muted'} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p>}

    <div className="import-section__columns">
      <section aria-label="Разобрать после импорта"><h3>Разобрать после импорта</h3>
        {tasks.length ? <ul className="import-tasks">{tasks.map((task) => <li key={task.id}><span>{task.label}</span><strong>{task.count}</strong><Link to={`/local/campaign/${campaign.id}/library?filter=${encodeURIComponent(JSON.stringify(task.filter))}`}>Открыть</Link></li>)}</ul> : <p className="muted">Всё разобрано.</p>}
      </section>
      <section aria-label="История импорта"><h3>История</h3>
        {log.length ? <ol className="import-log">{log.map((item) => <li key={item.id}><time>{date(item.at)}</time><span>{item.source}</span><small>{item.count} {KIND_LABEL[item.kind]}</small></li>)}</ol> : <EmptyState icon="history" title="Импортов ещё не было" hint="Здесь появятся записи о каждом импорте." />}
      </section>
    </div>
    {source && <ImportDialog campaign={campaign} persist={persist} stay close={() => setSource(false)} />}
    {sessions && <SessionImportDialog campaign={campaign} persist={persist} pending={sessions} close={() => setSessions(null)} />}
  </section>
}
