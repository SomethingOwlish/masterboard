import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Button, Icon } from '../ds'
import { LocalThemeControl } from '../components/LocalThemeControl'
import { useLocalCatalog } from '../local/useLocalCampaign'

/**
 * «Импорт» рядом со списком кампаний (ТЗ-2, R6): кампания целиком из файла и
 * новая кампания на основе мира, стола или системы. Импорт внутрь кампании —
 * в её разделе «Обмен → Импорт».
 */
export function ImportPage() {
  const catalog = useLocalCatalog()
  const shared = catalog.shared
  const navigate = useNavigate()
  const file = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const importFile = async (chosen?: File) => {
    if (!chosen) return
    try { const campaign = await catalog.importCampaign(await chosen.text()); navigate(`/local/campaign/${campaign.id}/overview`) } catch (failure) { setError(failure instanceof Error ? failure.message : 'Не удалось импортировать файл') }
  }
  return <main className="campaign-workspace">
    <header className="campaign-workspace__topbar"><div className="campaign-workspace__brand"><span>М</span><strong>Мастерборд</strong></div><div>{shared ? <Badge tone="accent" dot>{shared.email}</Badge> : <Badge tone="neutral" dot>Локальные данные</Badge>}<LocalThemeControl /></div></header>
    <section className="campaign-workspace__hero"><div><Link className="backups__back" to="/"><Icon name="arrow-left" size={15} /> Кампании</Link><span className="panel-kicker">Рабочее пространство ведущего</span><h1>Импорт</h1><p>Кампании из файла и из подключённых систем.</p></div></section>
    {error && <div className="campaign-workspace__recovery" role="alert"><Icon name="triangle-alert" size={18} /><span><strong>Не получилось.</strong> {error}</span><button onClick={() => setError(null)} aria-label="Закрыть сообщение"><Icon name="x" size={16} /></button></div>}
    <div className="import-tiles import-tiles--home">
      <article className="import-tile" aria-label="Кампания из файла"><header><Icon name="upload" size={18} /><strong>Кампания из файла</strong></header><p className="muted">Файл «Экспорта» кампании. Если такая уже есть, появится копия.</p><Button variant="primary" icon="upload" onClick={() => file.current?.click()}>Выбрать файл</Button></article>
      <article className="import-tile" aria-label="Кампания на основе"><header><Icon name="plug" size={18} /><strong>Кампания на основе</strong></header><p className="muted">Мир Лорбука, стол (ЛавГеймс, КК9) или система SystemSetup — можно несколько. После создания откроется выбор записей.</p><Link className="import-tile__link" to="/?create=1">Создать на основе</Link></article>
      <article className="import-tile" aria-label="Внутрь кампании"><header><Icon name="library" size={18} /><strong>Внутрь кампании</strong></header><p className="muted">Записи мира и стола, сессии и сущности из файла — в разделе кампании «Обмен → Импорт».</p></article>
    </div>
    <input ref={file} type="file" accept="application/json,.json" hidden aria-label="Файл кампании для импорта" onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = '' }} />
  </main>
}
