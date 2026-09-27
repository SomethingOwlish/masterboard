import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Icon } from '../ds'
import { LocalThemeControl } from '../components/LocalThemeControl'
import { backupCause, backupStateLabel, type BackupStatus } from '../local/backup'
import { ExternalError } from '../local/external'
import { useExternal } from '../local/useExternal'
import { useLocalCatalog } from '../local/useLocalCampaign'

type State =
  | { status: 'loading' }
  | { status: 'ready'; backup: BackupStatus }
  | { status: 'unconfigured' | 'error'; message: string }

const when = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

/**
 * Резервные копии (этап М5): рядом со списком кампаний, а не внутри одной —
 * копия делается сразу для всех общих кампаний. Саму копию делает lorebridge;
 * здесь итог последней, папка в GitHub и кнопка «Сделать сейчас» для любого
 * вошедшего мастера.
 */
export function BackupsPage() {
  const port = useExternal()
  const shared = useLocalCatalog().shared
  const [state, setState] = useState<State>({ status: 'loading' })
  const [running, setRunning] = useState(false)

  const fail = (error: unknown): State => ({ status: error instanceof ExternalError && error.unconfigured ? 'unconfigured' : 'error', message: error instanceof Error ? error.message : 'Не удалось связаться с мостом' })

  useEffect(() => {
    let alive = true
    port.backupStatus().then((backup) => { if (alive) setState({ status: 'ready', backup }) }, (error: unknown) => { if (alive) setState(fail(error)) })
    return () => { alive = false }
  }, [port])

  const runNow = async () => {
    setRunning(true)
    try { setState({ status: 'ready', backup: await port.backupNow() }) } catch (error) { setState(fail(error)) } finally { setRunning(false) }
  }

  const last = state.status === 'ready' ? state.backup.last : null
  return <main className="campaign-workspace">
    <header className="campaign-workspace__topbar"><div className="campaign-workspace__brand"><span>М</span><strong>Мастерборд</strong></div><div>{shared ? <Badge tone="accent" dot>{shared.email}</Badge> : <Badge tone="neutral" dot>Локальные данные</Badge>}<LocalThemeControl /></div></header>
    <section className="campaign-workspace__hero"><div><Link className="backups__back" to="/"><Icon name="arrow-left" size={15} /> Кампании</Link><span className="panel-kicker">Рабочее пространство ведущего</span><h1>Резервные копии</h1><p>Каждую ночь все общие кампании уходят в приватный репозиторий — по файлу на кампанию. Вернуть кампанию можно обычным «Импортом» на странице кампаний.</p></div><div className="row"><Button variant="primary" icon="refresh-cw" disabled={running || state.status === 'loading' || state.status === 'unconfigured'} onClick={() => void runNow()}>{running ? 'Делаю копию…' : 'Сделать сейчас'}</Button></div></section>
    <section className="backups" aria-label="Резервная копия" aria-busy={state.status === 'loading' || running}>
      {state.status === 'loading' && <p className="backups__line">Спрашиваю мост…</p>}
      {state.status === 'unconfigured' && <div className="campaign-workspace__recovery" role="status"><Icon name="cloud-off" size={18} /><span><strong>Резервная копия не подключена.</strong> {state.message}</span></div>}
      {state.status === 'error' && <div className="campaign-workspace__recovery" role="alert"><Icon name="triangle-alert" size={18} /><span><strong>Не получилось.</strong> {state.message}</span></div>}
      {state.status === 'ready' && <>
        {!state.backup.configured && <div className="campaign-workspace__recovery" role="status"><Icon name="cloud-off" size={18} /><span><strong>Мост настроен не до конца.</strong> Нет доступа к GitHub или дороги к Мастерборду — копия не пройдёт, пока его не донастроят.</span></div>}
        {last?.state === 'ошибка' && <div className="campaign-workspace__recovery" role="alert"><Icon name="triangle-alert" size={18} /><span><strong>{backupStateLabel[last.state]}</strong> {when(last.at)}, {backupCause(last)}. {last.error}</span></div>}
        <dl className="backups__facts">
          <div><dt>Последняя копия</dt><dd>{last ? <>{last.state !== 'ошибка' && <Badge tone={last.state === 'записано' ? 'success' : 'neutral'} dot>{backupStateLabel[last.state]}</Badge>} {when(last.at)}, {backupCause(last)}</> : 'Ещё не было — первая сделается ночью или по кнопке'}</dd></div>
          {last && last.state !== 'ошибка' && <div><dt>Кампаний в копии</dt><dd>{last.campaigns}</dd></div>}
          <div><dt>Расписание</dt><dd>{state.backup.schedule}</dd></div>
          {state.backup.folder && <div><dt>Где лежит</dt><dd><a href={state.backup.folder} target="_blank" rel="noreferrer">Папка «мастерборд» в GitHub <Icon name="external-link" size={13} /></a></dd></div>}
        </dl>
        <p className="campaign-workspace__boundary"><Icon name="hard-drive" size={15} /> В копию не входят несохранённые правки из браузера: они уедут, когда кампания сохранится на сервере.</p>
      </>}
    </section>
  </main>
}
