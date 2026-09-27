import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, Icon, Modal } from '../ds'
import type { QuarantinedRecord } from '../local/catalog'
import { mastersLabel } from '../local/team'
import type { LocalCampaignRecord } from '../local/types'
import { downloadText } from '../local/download'
import { useLocalCatalog } from '../local/useLocalCampaign'
import { LocalThemeControl } from '../components/LocalThemeControl'
import { useConfirm } from '../components/useConfirm'
import { liveSessions } from '../local/sessions'
import { BaseChooser } from '../components/local/BaseChooser'
import { baseIntegrations, baseName, type BaseChoice } from '../local/integration'
import { plural } from '../local/labels'

const sessionsLabel = (count: number) => count ? `${count} ${plural(count, 'сессия', 'сессии', 'сессий')}` : 'Без сессий'

export function LocalCampaignsPage() {
  const catalog = useLocalCatalog()
  const shared = catalog.shared
  const [waiting, setWaiting] = useState<LocalCampaignRecord[]>([])
  const [moving, setMoving] = useState(false)
  const [campaigns, setCampaigns] = useState<LocalCampaignRecord[] | null>(null)
  const [quarantined, setQuarantined] = useState<QuarantinedRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const [creating, setCreatingState] = useState(params.get('create') === '1')
  const setCreating = (value: boolean) => { setCreatingState(value); if (!value && params.has('create')) setParams({}) }
  const [name, setName] = useState('')
  const [idea, setIdea] = useState('')
  const [base, setBase] = useState<BaseChoice>({})
  const navigate = useNavigate()
  const confirm = useConfirm()

  const reload = async () => {
    try {
      const result = await catalog.load()
      setCampaigns(result.campaigns)
      setQuarantined(result.quarantined)
    } catch (loadError) {
      setCampaigns([])
      setError(loadError instanceof Error ? loadError.message : 'Хранилище браузера недоступно')
    }
  }
  useEffect(() => { void reload() }, [catalog]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (shared) void shared.browserCampaigns().then(setWaiting) }, [shared])

  const title = name.trim() || baseName(base)
  const create = async () => {
    if (!title) return
    const integrations = baseIntegrations(base)
    const campaign = await catalog.create(title, idea, integrations)
    setCreating(false); setName(''); setIdea(''); setBase({})
    // With a base, the campaign opens straight on «what to take from it» (R1).
    if (Object.keys(integrations).length) { navigate(`/local/campaign/${campaign.id}/overview?import=base`); return }
    await reload()
    window.setTimeout(() => document.getElementById(`campaign-${campaign.id}`)?.focus(), 0)
  }
  const moveAll = async () => {
    if (!shared) return
    setMoving(true)
    try {
      for (const campaign of waiting) await shared.share(campaign.id)
      setWaiting([])
      setError(null)
      await reload()
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Не удалось перенести кампании')
      setWaiting(await shared.browserCampaigns())
    } finally {
      setMoving(false)
    }
  }
  const moveOne = async (id: string) => {
    if (!shared) return
    setMoving(true)
    try {
      await shared.share(id)
      setError(null)
      await reload()
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Не удалось перенести кампанию')
    } finally {
      setWaiting(await shared.browserCampaigns())
      setMoving(false)
    }
  }
  /** Deletes campaigns kept only in this browser; the server copies, if any, are not touched. */
  const removeFromBrowser = (targets: LocalCampaignRecord[]) => {
    if (!shared?.removeFromBrowser || !targets.length) return
    confirm({
      title: targets.length === 1 ? `Удалить «${targets[0].name}» из браузера?` : `Удалить из браузера кампаний: ${targets.length}?`,
      message: 'Кампании, которые есть только в этом браузере, пропадут насовсем. Кампании на сервере не затрагиваются. Если сомневаетесь, сначала откройте кампанию и сделайте экспорт.',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      tone: 'danger',
      onConfirm: () => void (async () => {
        try {
          for (const campaign of targets) await shared.removeFromBrowser!(campaign.id)
          setError(null)
        } catch (removeError) {
          setError(removeError instanceof Error ? removeError.message : 'Не удалось удалить из браузера')
        }
        setWaiting(await shared.browserCampaigns())
      })(),
    })
  }
  const downloadDamaged = () => downloadText('masterboard-damaged-records.json', JSON.stringify(quarantined, null, 2))
  const dismissDamaged = async () => { await catalog.clearQuarantine(); setQuarantined([]) }

  return <main className="campaign-workspace">
    <header className="campaign-workspace__topbar"><div className="campaign-workspace__brand"><span>М</span><strong>Мастерборд</strong></div><div>{shared ? <><Badge tone="accent" dot>{shared.email}</Badge><a className="campaign-workspace__signout" href="/cdn-cgi/access/logout">Выйти</a></> : <Badge tone="neutral" dot>Локальные данные</Badge>}<LocalThemeControl /></div></header>
    <section className="campaign-workspace__hero"><div><span className="panel-kicker">Рабочее пространство ведущего</span><h1>Кампании</h1><p>Истории, подготовка и сессии вашей команды — в одном месте.</p></div><div className="row">{shared && <Link className="campaign-workspace__backups" to="/backups"><Icon name="history" size={16} /> Резервные копии</Link>}<Link className="campaign-workspace__backups" to="/players"><Icon name="users" size={16} /> Игроки</Link><Link className="campaign-workspace__backups" to="/import"><Icon name="import" size={16} /> Импорт</Link><Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Создать кампанию</Button></div></section>
    {waiting.length > 0 && <div className="campaign-workspace__move" role="status"><Icon name="cloud" size={18} /><span><strong>В этом браузере {waiting.length === 1 ? '1 кампания' : `кампаний: ${waiting.length}`}</strong> ({waiting.map((item) => item.name).join(', ')}). Перенесите на сервер — вы станете владельцем, кампании будут доступны с любого устройства. Ненужные можно удалить.</span><div className="row"><Button variant="primary" icon="cloud" disabled={moving} onClick={() => void moveAll()}>{moving ? 'Переносим…' : waiting.length === 1 ? 'Перенести' : 'Перенести все'}</Button>{shared?.removeFromBrowser && <Button tone="danger" icon="trash-2" disabled={moving} onClick={() => removeFromBrowser(waiting)}>{waiting.length === 1 ? 'Удалить' : 'Удалить все'}</Button>}</div>
      {waiting.length > 1 && <ul className="campaign-workspace__move-list" aria-label="Кампании в этом браузере">{waiting.map((item) => <li key={item.id}><span><strong>{item.name}</strong> <small>{sessionsLabel(item.sessionRecords.length)}</small></span><Button size="sm" icon="cloud" disabled={moving} onClick={() => void moveOne(item.id)} aria-label={`Перенести на сервер: ${item.name}`}>Перенести</Button>{shared?.removeFromBrowser && <Button size="sm" tone="danger" icon="trash-2" disabled={moving} onClick={() => removeFromBrowser([item])} aria-label={`Удалить из браузера: ${item.name}`}>Удалить</Button>}</li>)}</ul>}
    </div>}
    {quarantined.length > 0 && <div className="campaign-workspace__recovery" role="alert"><Icon name="triangle-alert" size={18} /><span><strong>Найдены повреждённые данные: {quarantined.length}.</strong> Мы отложили их, ничего не удаляя. Скачайте копию, прежде чем убрать сообщение.</span><div className="row"><Button size="sm" icon="download" onClick={downloadDamaged}>Скачать копию</Button><Button size="sm" onClick={() => void dismissDamaged()}>Убрать</Button></div></div>}
    {error && <div className="campaign-workspace__recovery" role="alert"><Icon name="triangle-alert" size={18} /><span><strong>Не получилось.</strong> {error}</span><button onClick={() => setError(null)} aria-label="Закрыть сообщение"><Icon name="x" size={16} /></button></div>}
    <section className="campaign-workspace__grid" aria-label="Список кампаний" aria-busy={campaigns === null}>
      {(campaigns ?? []).filter((campaign) => !campaign.archived).map((campaign, index) => <article key={campaign.id} className="campaign-workspace__card"><Link id={`campaign-${campaign.id}`} to={`/local/campaign/${campaign.id}`}><div className="campaign-workspace__cover"><span>{String(index + 1).padStart(2, '0')}</span><i>{campaign.name.slice(0, 1)}</i></div><div className="campaign-workspace__body"><span className="panel-kicker">{sessionsLabel(liveSessions(campaign).length)}</span><h2>{campaign.name}</h2><p>{campaign.idea}</p><dl><div><dt>Текущее время</dt><dd>{campaign.activeTime}</dd></div><div><dt>Ведущие</dt><dd>{mastersLabel(campaign)}</dd></div></dl></div><footer><span>{campaign.sessionRecords.length ? 'Открыть кампанию' : 'Продолжить подготовку'}</span><Icon name="arrow-right" size={17} /></footer></Link></article>)}
      <button className="campaign-workspace__new" onClick={() => setCreating(true)}><Icon name="plus" size={24} /><strong>Новая кампания</strong><span>Начать с чистого пространства</span></button>
    </section>
    {(campaigns ?? []).some((campaign) => campaign.archived) && <section className="campaign-workspace__archive" aria-label="Архив кампаний"><h2>Архив</h2><ul>{(campaigns ?? []).filter((campaign) => campaign.archived).map((campaign) => <li key={campaign.id}><Link to={`/local/campaign/${campaign.id}/team`}>{campaign.name}</Link><span>{campaign.sessionRecords.length} сесс. · {mastersLabel(campaign)}</span></li>)}</ul></section>}
    {shared ? <p className="campaign-workspace__boundary"><Icon name="cloud" size={15} /> Кампании хранятся на сервере и видны всем их мастерам. Со-мастера добавляются по почте в разделе «Команда».</p> : <p className="campaign-workspace__boundary"><Icon name="hard-drive" size={15} /> Всё хранится в браузере (IndexedDB). Для переноса используйте экспорт и импорт. Интеграции пока отключены.</p>}
    <p className="campaign-workspace__version" aria-label="Версия сборки">Версия <code>{__BUILD_HASH__}</code> · собрана {new Date(__BUILD_TIME__).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
    {creating && (
      <Modal
        kicker="Новая кампания"
        title="С чего начинается история?"
        size="lg"
        className="dialog-form"
        dirty={Boolean(name.trim() || idea.trim() || Object.values(base).some(Boolean))}
        onClose={() => setCreating(false)}
      >
        <label htmlFor="campaign-name">Название<input autoFocus id="campaign-name" name="campaign-name" value={name} placeholder={baseName(base) || 'Например, Город под стеклом'} onChange={(event) => setName(event.target.value)} /></label>
        <label htmlFor="campaign-idea">Короткая идея<textarea id="campaign-idea" name="campaign-idea" rows={3} value={idea} placeholder="О чём эта кампания?" onChange={(event) => setIdea(event.target.value)} /></label>
        <BaseChooser value={base} onChange={setBase} />
        {shared ? <p><Icon name="cloud" size={15} /> Кампания сохранится на сервере, вы — её владелец.</p> : <p><Icon name="hard-drive" size={15} /> Кампания сохранится только в этом браузере.</p>}
        <footer>
          <Button onClick={() => setCreating(false)}>Отмена</Button>
          <Button variant="primary" icon="plus" disabled={!title} onClick={() => void create()}>{Object.keys(baseIntegrations(base)).length ? 'Создать и выбрать записи' : 'Создать'}</Button>
        </footer>
      </Modal>
    )}
  </main>
}
