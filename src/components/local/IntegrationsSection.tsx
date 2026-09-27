import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Icon } from '../../ds'
import type { CapabilityPassport, ExternalSystem } from '../../model/external'
import { useActing } from '../../local/actingContext'
import { ROLE_HINT, ROLE_LABEL, ROLE_SYSTEMS, SYSTEM_LABEL, WRITABLE_ROLES, linkedRole, roleConnection, rulesFor, withLink, linkOf, type BaseOption, type CampaignRole, type WritableRole } from '../../local/integration'
import type { LocalCampaignEntityType, LocalCampaignRecord } from '../../local/types'
import { useBaseOptions, useExternal } from '../../local/useExternal'
import { useConfirm } from '../useConfirm'
import { ENTITY_TYPES, Editor, type Persist, type SectionProps } from './shared'

const ROLES: CampaignRole[] = ['world', 'table', 'system']
const date = (value?: string) => value ? new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

/**
 * Интеграции (ТЗ-2, R10): the campaign's world, table and system. Linked ones
 * read as a fact with «Сменить» and «Отвязать»; a new link goes through the
 * wizard: system → record → check → rules. Only the owner changes them.
 */
export function IntegrationsSection({ campaign, persist }: SectionProps) {
  const acting = useActing(campaign)
  const confirm = useConfirm()
  const [wizard, setWizard] = useState<CampaignRole | null>(null)
  const unlink = (role: CampaignRole) => {
    const linked = linkedRole(campaign, role)
    if (!linked) return
    confirm({
      title: `Отвязать ${SYSTEM_LABEL[linked.system]} «${linked.link.label}»?`,
      message: 'Сущности останутся в библиотеке со ссылками на записи там. Новые отправки туда прекратятся, пока вы не подключите снова.',
      confirmLabel: 'Отвязать', cancelLabel: 'Отмена', tone: 'danger',
      onConfirm: () => persist(withLink(campaign, linked.system, null)),
    })
  }
  return <section className="campaign-section integrations-section">
    <div className="section-bar"><div><span className="panel-kicker">Обмен</span><h2>Интеграции</h2></div><p className="muted">{acting.canManage ? 'Мир, стол и система этой кампании. Меняет только владелец.' : 'Меняет владелец кампании.'}</p></div>
    <div className="integrations-section__roles">{ROLES.map((role) => {
      const linked = linkedRole(campaign, role)
      return <article key={role} className={`integration-card${linked ? ' integration-card--on' : ''}`} aria-label={ROLE_LABEL[role]}>
        <header><strong>{ROLE_LABEL[role]}</strong><small>{ROLE_SYSTEMS[role].map((system) => SYSTEM_LABEL[system]).join(' · ')}</small></header>
        {linked ? <>
          <p className="integration-card__state"><Icon name="check" size={16} /> {SYSTEM_LABEL[linked.system]} · {linked.link.url ? <a href={linked.link.url} target="_blank" rel="noreferrer">{linked.link.label}</a> : linked.link.label}</p>
          <small className="muted">{linked.link.checkedAt ? `Связь проверена ${date(linked.link.checkedAt)}` : 'Связь ещё не проверялась'}</small>
          {acting.canManage && <footer><Button size="sm" icon="refresh-cw" onClick={() => setWizard(role)}>Сменить</Button><Button size="sm" tone="danger" icon="unlink" onClick={() => unlink(role)}>Отвязать</Button></footer>}
        </> : <>
          <p className="muted">{ROLE_HINT[role]}</p>
          {acting.canManage ? <footer><Button size="sm" variant="primary" icon="plug" onClick={() => setWizard(role)}>Подключить</Button></footer> : <small className="muted">Не подключено</small>}
        </>}
      </article>
    })}</div>
    <RulesTable campaign={campaign} persist={persist} editable={acting.canManage} />
    <p className="muted integrations-section__next">Отправка — в разделе <Link to={`/local/campaign/${campaign.id}/publish`}>«Публикация»</Link>; забрать записи — в <Link to={`/local/campaign/${campaign.id}/library?import=1`}>«Библиотеке» → «Из источника»</Link>.</p>
    {wizard && <ConnectWizard campaign={campaign} persist={persist} role={wizard} close={() => setWizard(null)} />}
  </section>
}

/** Where each type goes by default (R3). A role the campaign has not linked is shown but inactive. */
function RulesTable({ campaign, persist, editable, only }: { campaign: LocalCampaignRecord; persist: Persist; editable: boolean; only?: CampaignRole }) {
  const roles = only ? [only] : WRITABLE_ROLES
  const toggle = (type: LocalCampaignEntityType, role: CampaignRole) => {
    const current = rulesFor(campaign, type)
    const next = current.includes(role as WritableRole) ? current.filter((item) => item !== role) : [...current, role as WritableRole]
    persist({ ...campaign, publishRules: { ...campaign.publishRules, [type]: next } })
  }
  const changed = Object.keys(campaign.publishRules ?? {}).length > 0
  return <div className="integrations-rules">
    <div className="section-bar section-bar--sub"><h3>Куда уходят сущности по умолчанию</h3>{editable && changed && !only && <Button size="sm" onClick={() => persist({ ...campaign, publishRules: undefined })}>Как было</Button>}</div>
    <p className="muted">Лор — в мир, персонажи и вещи — на стол, остальное остаётся здесь. В карточке сущности выбор можно поменять.</p>
    <div className="integrations-rules__table" role="table" aria-label="Правила отправки">
      <div role="row" className="integrations-rules__head"><span role="columnheader">Тип</span>{roles.map((role) => <span key={role} role="columnheader">{ROLE_LABEL[role]}{only || linkedRole(campaign, role) ? '' : ' · не подключён'}</span>)}</div>
      {ENTITY_TYPES.map((type) => <div role="row" key={type.value}><span role="cell">{type.label}</span>{roles.map((role) => {
        const on = rulesFor(campaign, type.value).includes(role as WritableRole)
        return <span role="cell" key={role}><label className="rule-toggle"><input type="checkbox" disabled={!editable} checked={on} onChange={() => toggle(type.value, role)} aria-label={`${type.label} → ${ROLE_LABEL[role]}`} />{on ? 'да' : '—'}</label></span>
      })}</div>)}
    </div>
  </div>
}

type Check = { status: 'idle' | 'checking' } | { status: 'ok'; passport: CapabilityPassport } | { status: 'failed'; message: string }

/** Мастер подключения: 1) система → 2) запись → 3) проверка → 4) правила. */
function ConnectWizard({ campaign, persist, role, close }: { campaign: LocalCampaignRecord; persist: Persist; role: CampaignRole; close: () => void }) {
  const port = useExternal()
  const base = useBaseOptions()
  const current = linkedRole(campaign, role)
  const [step, setStep] = useState(ROLE_SYSTEMS[role].length > 1 ? 1 : 2)
  const [system, setSystem] = useState<ExternalSystem>(current?.system ?? ROLE_SYSTEMS[role][0])
  const [choice, setChoice] = useState<BaseOption | null>(null)
  const [check, setCheck] = useState<Check>({ status: 'idle' })
  const [draft, setDraft] = useState<LocalCampaignRecord>(campaign)
  const options = base.status === 'ready' ? base.options[role].filter((item) => item.system === system) : []
  const connectionId = choice ? roleConnection(choice.system, linkOf(choice)) : ''
  useEffect(() => {
    if (step !== 3 || !connectionId) return
    let alive = true
    setCheck({ status: 'checking' })
    port.getPassport(connectionId).then((passport) => { if (alive) setCheck({ status: 'ok', passport }) }, (error: unknown) => { if (alive) setCheck({ status: 'failed', message: error instanceof Error ? error.message : 'Не отвечает' }) })
    return () => { alive = false }
  }, [port, step, connectionId])
  const finish = () => {
    if (!choice) return
    const linked = withLink({ ...campaign, publishRules: draft.publishRules }, choice.system, linkOf(choice, check.status === 'ok' ? new Date().toISOString() : undefined))
    persist(linked)
    close()
  }
  const steps = ROLE_SYSTEMS[role].length > 1 ? ['Система', 'Запись', 'Проверка', 'Правила'] : ['', 'Запись', 'Проверка', 'Правила']
  const last = role === 'system' ? 3 : 4
  return <Editor kicker={`Подключение · ${ROLE_LABEL[role]}`} title={role === 'table' ? 'Стол кампании' : role === 'world' ? 'Мир кампании' : 'Игровая система'} close={close}>
    <ol className="wizard-steps" aria-label="Шаги">{steps.map((label, index) => label && index < last ? <li key={label} className={index + 1 === step ? 'active' : index + 1 < step ? 'done' : ''}>{label}</li> : null)}</ol>
    {step === 1 && <fieldset className="wizard-choice"><legend>Какой стол</legend>{ROLE_SYSTEMS[role].map((item) => <label key={item}><input type="radio" name="wizard-system" checked={system === item} onChange={() => { setSystem(item); setChoice(null) }} /><span><strong>{SYSTEM_LABEL[item]}</strong><small>{item === 'kk9' ? 'Стол КК9: персонажи, НПС-библиотека, предметы, состояние стола' : 'Кампания ЛавГеймс: НПС, раздатки, кодекс'}</small></span></label>)}</fieldset>}
    {step === 2 && <>
      {base.status === 'loading' && <p className="muted" role="status">Узнаём, что вам доступно…</p>}
      {(base.status === 'unconfigured' || base.status === 'error') && <p className="local-session-error" role="alert">{base.status === 'unconfigured' ? 'Связь с внешними системами ещё не настроена на сервере Мастерборда.' : base.message}</p>}
      {base.status === 'ready' && (options.length ? <fieldset className="wizard-choice"><legend>{role === 'world' ? 'Мир Лорбука' : role === 'table' ? `Кампания ${SYSTEM_LABEL[system]}` : 'Система SystemSetup'}</legend>{options.map((item) => <label key={item.externalId}><input type="radio" name="wizard-record" checked={choice?.externalId === item.externalId} onChange={() => setChoice(item)} /><span><strong>{item.label}</strong>{current?.link.externalId === item.externalId && <Badge size="sm" tone="accent">сейчас</Badge>}</span></label>)}</fieldset> : <p className="muted">В {SYSTEM_LABEL[system]} вам пока ничего не доступно. Нужна запись, где вы мастер или автор.</p>)}
    </>}
    {step === 3 && <div className="wizard-check" role="status">
      {check.status === 'checking' && <p className="muted">Проверяем связь с {SYSTEM_LABEL[system]}…</p>}
      {check.status === 'ok' && <><p className="integration-card__state"><Icon name="check" size={16} /> {SYSTEM_LABEL[system]} отвечает, «{choice?.label}» доступен.</p><p className="muted">Принимает: {check.passport.entities.filter((item) => item.enabled).map((item) => `${item.label}${item.operations.some((op) => op !== 'read') ? '' : ' (только чтение)'}`).join(', ') || 'ничего'}.</p></>}
      {check.status === 'failed' && <p className="local-session-error">Связь не проверена: {check.message}. Подключить можно, отправка заработает, когда система ответит.</p>}
    </div>}
    {step === 4 && <RulesTable campaign={draft} persist={setDraft} editable only={role} />}
    <footer>
      {step > (ROLE_SYSTEMS[role].length > 1 ? 1 : 2) && <Button onClick={() => setStep(step - 1)}>Назад</Button>}
      <Button onClick={close}>Отмена</Button>
      {step < last ? <Button variant="primary" disabled={(step === 2 && !choice) || (step === 3 && check.status === 'checking')} onClick={() => setStep(step + 1)}>Далее</Button> : <Button variant="primary" icon="plug" disabled={!choice} onClick={finish}>Подключить</Button>}
    </footer>
  </Editor>
}
