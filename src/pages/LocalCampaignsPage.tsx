import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Icon } from '../ds'
import type { QuarantinedRecord } from '../local/catalog'
import { mastersLabel } from '../local/team'
import type { LocalCampaignRecord } from '../local/types'
import { downloadText } from '../local/download'
import { useLocalCatalog } from '../local/useLocalCampaign'
import { LocalThemeControl } from '../components/LocalThemeControl'

const sessionsLabel = (count: number) => {
  if (!count) return 'Без сессий'
  const mod10 = count % 10, mod100 = count % 100
  const word = mod10 === 1 && mod100 !== 11 ? 'сессия' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'сессии' : 'сессий'
  return `${count} ${word}`
}

export function LocalCampaignsPage() {
  const catalog = useLocalCatalog()
  const shared = catalog.shared
  const [sharing, setSharing] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<LocalCampaignRecord[] | null>(null)
  const [quarantined, setQuarantined] = useState<QuarantinedRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [idea, setIdea] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

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
  useEffect(() => { if (!creating) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setCreating(false) }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [creating])

  const create = async () => {
    if (!name.trim()) return
    const campaign = await catalog.create(name, idea)
    await reload()
    setCreating(false); setName(''); setIdea('')
    window.setTimeout(() => document.getElementById(`campaign-${campaign.id}`)?.focus(), 0)
  }
  const importFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const campaign = await catalog.importCampaign(await file.text())
      setError(null)
      await reload()
      window.setTimeout(() => document.getElementById(`campaign-${campaign.id}`)?.focus(), 0)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Не удалось импортировать файл')
    }
  }
  const share = async (campaign: LocalCampaignRecord) => {
    if (!shared) return
    setSharing(campaign.id)
    try {
      const result = await shared.share(campaign.id)
      setError(null)
      await reload()
      window.setTimeout(() => document.getElementById(`campaign-${result.id}`)?.focus(), 0)
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Не удалось сделать кампанию общей')
    } finally {
      setSharing(null)
    }
  }
  const downloadDamaged = () => downloadText('masterboard-damaged-records.json', JSON.stringify(quarantined, null, 2))
  const dismissDamaged = async () => { await catalog.clearQuarantine(); setQuarantined([]) }

  return <main className="campaign-workspace">
    <header className="campaign-workspace__topbar"><div className="campaign-workspace__brand"><span>М</span><strong>Мастерборд</strong></div><div>{shared ? <Badge tone="accent" dot>Вход: {shared.email}</Badge> : <Badge tone="neutral" dot>Локальные данные</Badge>}<LocalThemeControl /></div></header>
    <section className="campaign-workspace__hero"><div><span className="panel-kicker">Рабочее пространство ведущего</span><h1>Кампании</h1><p>Истории, подготовка и сессии вашей команды — в одном месте.</p></div><div className="row"><Button icon="upload" onClick={() => fileInput.current?.click()}>Импорт</Button><Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Создать кампанию</Button></div><input ref={fileInput} type="file" accept="application/json,.json" hidden aria-label="Файл кампании для импорта" onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = '' }} /></section>
    {quarantined.length > 0 && <div className="campaign-workspace__recovery" role="alert"><Icon name="triangle-alert" size={18} /><span><strong>Найдены повреждённые данные: {quarantined.length}.</strong> Мы отложили их, ничего не удаляя. Скачайте копию, прежде чем убрать сообщение.</span><div className="row"><Button size="sm" icon="download" onClick={downloadDamaged}>Скачать копию</Button><Button size="sm" onClick={() => void dismissDamaged()}>Убрать</Button></div></div>}
    {error && <div className="campaign-workspace__recovery" role="alert"><Icon name="triangle-alert" size={18} /><span><strong>Не получилось.</strong> {error}</span><button onClick={() => setError(null)} aria-label="Закрыть сообщение"><Icon name="x" size={16} /></button></div>}
    <section className="campaign-workspace__grid" aria-label="Список кампаний" aria-busy={campaigns === null}>
      {(campaigns ?? []).filter((campaign) => !campaign.archived).map((campaign, index) => <article key={campaign.id} className="campaign-workspace__card"><Link id={`campaign-${campaign.id}`} to={`/local/campaign/${campaign.id}`}><div className="campaign-workspace__cover"><span>{String(index + 1).padStart(2, '0')}</span><i>{campaign.name.slice(0, 1)}</i></div><div className="campaign-workspace__body"><span className="panel-kicker">{sessionsLabel(campaign.sessionRecords.length)}</span><h2>{campaign.name}</h2><p>{campaign.idea}</p><dl><div><dt>Текущее время</dt><dd>{campaign.activeTime}</dd></div><div><dt>Ведущие</dt><dd>{mastersLabel(campaign)}</dd></div></dl></div><footer><span>{campaign.sessionRecords.length ? 'Открыть кампанию' : 'Продолжить подготовку'}</span><Icon name="arrow-right" size={17} /></footer></Link>{shared && (shared.isShared(campaign.id) ? <div className="campaign-workspace__sharing"><Badge size="sm" tone="accent" dot>Общая</Badge></div> : <div className="campaign-workspace__sharing"><Badge size="sm" tone="neutral">Только в этом браузере</Badge><Button size="sm" icon="cloud" disabled={sharing !== null} aria-label={`Сделать общей: ${campaign.name}`} onClick={() => void share(campaign)}>{sharing === campaign.id ? 'Переносим…' : 'Сделать общей'}</Button></div>)}</article>)}
      <button className="campaign-workspace__new" onClick={() => setCreating(true)}><Icon name="plus" size={24} /><strong>Новая кампания</strong><span>Начать с чистого пространства</span></button>
    </section>
    {(campaigns ?? []).some((campaign) => campaign.archived) && <section className="campaign-workspace__archive" aria-label="Архив кампаний"><h2>Архив</h2><ul>{(campaigns ?? []).filter((campaign) => campaign.archived).map((campaign) => <li key={campaign.id}><Link to={`/local/campaign/${campaign.id}/team`}>{campaign.name}</Link><span>{campaign.sessionRecords.length} сесс. · {mastersLabel(campaign)}</span></li>)}</ul></section>}
    {shared ? <p className="campaign-workspace__boundary"><Icon name="cloud" size={15} /> Общие кампании хранятся на сервере и видны всем их мастерам. Остальные — только в этом браузере; кнопка «Сделать общей» переносит кампанию на сервер, а вы становитесь её владельцем.</p> : <p className="campaign-workspace__boundary"><Icon name="hard-drive" size={15} /> Всё хранится в браузере (IndexedDB). Для переноса используйте экспорт и импорт. Интеграции пока отключены.</p>}
    {creating && <div className="campaign-workspace__scrim"><section className="campaign-workspace__modal" role="dialog" aria-modal="true" aria-labelledby="new-campaign-title"><span className="panel-kicker">Новая кампания</span><h2 id="new-campaign-title">С чего начинается история?</h2><label htmlFor="campaign-name">Название<input autoFocus id="campaign-name" name="campaign-name" value={name} placeholder="Например, Город под стеклом" onChange={(event) => setName(event.target.value)} /></label><label htmlFor="campaign-idea">Короткая идея<textarea id="campaign-idea" name="campaign-idea" rows={4} value={idea} placeholder="О чём эта кампания?" onChange={(event) => setIdea(event.target.value)} /></label><p><Icon name="hard-drive" size={15} /> Кампания сохранится только в этом браузере.</p><div><Button onClick={() => setCreating(false)}>Отмена</Button><Button variant="primary" icon="plus" disabled={!name.trim()} onClick={() => void create()}>Создать</Button></div></section></div>}
  </main>
}
