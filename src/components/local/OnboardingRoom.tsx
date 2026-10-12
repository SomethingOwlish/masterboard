import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, EmptyState, Icon } from '../../ds'
import { blankSession, withLocalSessions, worldStarted } from '../../local/normalize'
import { ownerOf } from '../../local/team'
import { CampaignHeader, Capture, type SectionProps } from './shared'
import { ROLE_LABEL, SYSTEM_LABEL, linkedRole, type CampaignRole } from '../../local/integration'
import { ImportDialog } from './SourcePanels'
import { IDEA_PLACEHOLDER, plural } from '../../local/labels'

const ROLES: CampaignRole[] = ['world', 'table', 'system']

/**
 * «Обзор» of a new campaign: collect anchor notes and create session 1. The
 * campaign menu above already opens the library, notes, team, import and integrations.
 */
export function OnboardingRoom({ campaign, persist }: SectionProps) {
  const [note, setNote] = useState('')
  const [title, setTitle] = useState('')
  const [params, setParams] = useSearchParams()
  const importing = params.get('import') === 'base'
  const base = ROLES.flatMap((role) => { const linked = linkedRole(campaign, role); return linked ? [`${ROLE_LABEL[role]}: ${SYSTEM_LABEL[linked.system]} · ${linked.link.label}`] : [] })
  const started = worldStarted(campaign)
  const entities = campaign.entities.filter((entity) => entity.status !== 'archived').length
  const addNote = () => { const text = note.trim(); if (!text) return; persist({ ...campaign, notes: [...campaign.notes, text] }); setNote('') }
  const createSession = () => {
    if (!title.trim()) return
    const session = { ...blankSession(1, ownerOf(campaign).id, new Date().toISOString()), title: title.trim() }
    persist(withLocalSessions(campaign, [session], session.id))
  }
  const libraryLink = entities > 0 && (
    <p className="new-campaign-room__library">
      <Icon name="library" size={15} />
      {' '}
      В библиотеке {entities} {plural(entities, 'запись', 'записи', 'записей')}.
      {' '}
      <Link to={`/local/campaign/${campaign.id}/library`}>Открыть библиотеку</Link>
    </p>
  )
  return <main className="new-campaign-room">
    <CampaignHeader
      campaign={campaign}
      section="overview"
      onboarding
    />
    <section className="new-campaign-room__hero">
      <div>
        <span className="panel-kicker">Новая кампания</span>
        <h1>{campaign.name}</h1>
        <p className={campaign.idea ? undefined : 'muted'}>{campaign.idea || IDEA_PLACEHOLDER}</p>
      </div>
      <div className={`new-campaign-room__readiness${started ? ' ready' : ''}`}>
        <span>Первичная настройка</span>
        <strong>{started ? 'Мир начат' : 'Мир пуст'}</strong>
      </div>
    </section>
    <div className="new-campaign-room__layout">
      <section className="new-campaign-room__main">
        {!campaign.notes.length
          ? <EmptyState
            icon="book-open"
            title={entities ? 'Заметок пока нет' : 'Мир пока пуст'}
            hint={entities ? 'Основа уже в библиотеке. Добавьте первую заметку — факт, персонажа или место.' : 'Запишите первый факт, персонажа или место.'}
            action={<Capture value={note} setValue={setNote} add={addNote} />}
          />
          : <>
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Первые опорные точки</span>
                <h2>Заметки кампании</h2>
              </div>
            </div>
            <ol className="new-campaign-room__notes">
              {campaign.notes.map((item, index) => (
                <li key={`${item}-${index}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{item}</p>
                </li>
              ))}
            </ol>
            <Capture value={note} setValue={setNote} add={addNote} />
          </>}
        {libraryLink}
      </section>
      <aside className="new-campaign-room__setup">
        {base.length > 0 && (
          <div className="new-campaign-room__base">
            <span className="panel-kicker">Основа</span>
            <ul>{base.map((line) => <li key={line}><Icon name="check" size={14} /> {line}</li>)}</ul>
            <Button icon="download" block onClick={() => setParams({ import: 'base' })}>Выбрать записи из основы</Button>
          </div>
        )}
        <span className="panel-kicker">Быстрый старт</span>
        <h2>Подготовьте первую игру</h2>
        <label htmlFor="first-session">
          Название первой сессии
          <input
            id="first-session"
            value={title}
            placeholder="Встреча у старых ворот"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createSession() }}
          />
        </label>
        <Button variant="primary" block disabled={!title.trim()} onClick={createSession}>Создать сессию и открыть дашборд</Button>
        <div className="new-campaign-room__steps">
          <span className={started ? 'done' : ''}>
            <Icon name={started ? 'check' : 'circle'} size={16} />
            {' '}
            Добавить опорную точку или записи из основы (по желанию)
          </span>
          <span>
            <Icon name="circle" size={16} />
            {' '}
            Создать первую сессию
          </span>
        </div>
      </aside>
    </div>
    <p className="local-session-footnote">
      <Icon name="info" size={14} />
      {' '}
      Сессии, сюжет, пульт и публикация откроются после создания первой сессии. Библиотека, заметки, команда, импорт
      и интеграции — уже в меню выше.
    </p>
    {importing && <ImportDialog campaign={campaign} persist={persist} stay close={() => setParams({})} />}
  </main>
}
