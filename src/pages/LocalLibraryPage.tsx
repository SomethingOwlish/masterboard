import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Checkbox, EmptyState, Icon, Select } from '../ds'
import { localLibraryDemo } from '../fixtures/localDemoRuntime'
import type { EntityLibraryRecord, EntityOrigin, TargetEntityType } from '../storage/entityLibrary'

const TYPES: Array<{ value: TargetEntityType | ''; label: string }> = [
  { value: '', label: 'Все типы' },
  { value: 'character', label: 'Персонажи' },
  { value: 'npc', label: 'Персонажи ведущего' },
  { value: 'creature', label: 'Существа' },
  { value: 'location', label: 'Локации' },
  { value: 'faction', label: 'Фракции' },
  { value: 'rumor', label: 'Слухи' },
  { value: 'item', label: 'Предметы' },
  { value: 'audience', label: 'Аудитории' },
  { value: 'note', label: 'Заметки' },
  { value: 'letter', label: 'Письма' },
  { value: 'handout', label: 'Раздаточные материалы' },
  { value: 'map', label: 'Карты' },
  { value: 'home-rule', label: 'Домашние правила' },
]

const CREATE_TYPES = TYPES.filter((item) => item.value !== '') as Array<{ value: TargetEntityType; label: string }>
const ORIGIN_LABEL: Record<EntityOrigin, string> = {
  masterboard: 'Masterboard', lovegame: 'Lovegame', lorebook: 'Lorebook', systemsetup: 'Systemsetup',
}

const TYPE_LABEL = Object.fromEntries(CREATE_TYPES.map((item) => [item.value, item.label])) as Record<TargetEntityType, string>
const DETAIL_FIELD: Record<TargetEntityType, { key: string; label: string; placeholder: string }> = {
  character: { key: 'concept', label: 'Концепция персонажа', placeholder: 'Роль, характер и внутренний конфликт' },
  npc: { key: 'currentState', label: 'Текущее состояние', placeholder: 'Чего хочет и что делает сейчас' },
  creature: { key: 'behavior', label: 'Поведение', placeholder: 'Повадки, инстинкты и слабости' },
  location: { key: 'currentState', label: 'Состояние места', placeholder: 'Что здесь происходит сейчас' },
  item: { key: 'properties', label: 'Свойства', placeholder: 'Эффект, цена или особенность' },
  faction: { key: 'goals', label: 'Цели фракции', placeholder: 'Чего добивается организация' },
  audience: { key: 'preferences', label: 'Особенности аудитории', placeholder: 'Интересы, знания и ограничения' },
  rumor: { key: 'text', label: 'Текст слуха', placeholder: 'Как его пересказывают в мире' },
  letter: { key: 'text', label: 'Текст письма', placeholder: 'Содержание послания' },
  handout: { key: 'playerDraft', label: 'Версия для игроков', placeholder: 'Что получат игроки' },
  map: { key: 'scale', label: 'Масштаб и ориентиры', placeholder: 'Район, расстояния, важные точки' },
  'home-rule': { key: 'ruleText', label: 'Текст правила', placeholder: 'Условие и игровой эффект' },
  note: { key: 'text', label: 'Содержание заметки', placeholder: 'Рабочая мысль ведущего' },
}

function summary(record: EntityLibraryRecord) {
  const entity = record.entity
  return String(entity.description ?? entity.concept ?? entity.currentState ?? entity.text ?? entity.truth ?? '')
}

export function LocalLibraryPage() {
  const demo = useMemo(() => localLibraryDemo, [])
  const [records, setRecords] = useState<EntityLibraryRecord[]>([])
  const [query, setQuery] = useState('')
  const [type, setType] = useState<TargetEntityType | ''>('')
  const [origin, setOrigin] = useState<EntityOrigin | ''>('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [inspected, setInspected] = useState<EntityLibraryRecord | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [createType, setCreateType] = useState<TargetEntityType>('npc')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editDetail, setEditDetail] = useState('')

  const reload = useCallback(async () => {
    const next = await demo.load({
      query,
      types: type ? [type] : undefined,
      origin: origin || undefined,
      includeArchived,
    })
    setRecords(next)
    setInspected((current) => current ? next.find((record) => record.id === current.id) ?? current : null)
  }, [demo, includeArchived, origin, query, type])

  useEffect(() => { void reload().catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load library')) }, [reload])

  const createEntity = async () => {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const created = await demo.create({
        entityType: createType,
        name,
        description,
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      })
      setQuery('')
      setType('')
      setOrigin('')
      const next = await demo.load({ includeArchived })
      setRecords(next)
      setInspected(next.find((record) => created.path.endsWith(`/${record.id}`)) ?? null)
      setCreating(false)
      setName('')
      setDescription('')
      setTags('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create entity')
    } finally {
      setBusy(false)
    }
  }

  const archiveSelected = async () => {
    setBusy(true)
    setError(null)
    try {
      await demo.setArchived(selectedIds, true)
      setSelectedIds([])
      setSelectMode(false)
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not archive selection')
    } finally {
      setBusy(false)
    }
  }

  const openRecord = (record: EntityLibraryRecord) => {
    if (selectMode) {
      setSelectedIds((current) => current.includes(record.id) ? current.filter((id) => id !== record.id) : [...current, record.id])
    } else {
      setInspected(record)
      setCreating(false)
      setEditing(false)
    }
  }

  const startEditing = () => {
    if (!inspected) return
    const field = DETAIL_FIELD[inspected.entity.entityType]
    setEditName(inspected.entity.name); setEditStatus(String(inspected.entity.status ?? 'active')); setEditDescription(String(inspected.entity.description ?? ''))
    setEditTags(inspected.entity.tags.join(', ')); setEditDetail(String(inspected.entity[field.key] ?? '')); setEditing(true)
  }
  const saveEntity = async () => {
    if (!inspected || !editName.trim()) return
    setBusy(true); setError(null)
    try {
      const field = DETAIL_FIELD[inspected.entity.entityType]
      await demo.update(inspected.id, { name: editName, status: editStatus, description: editDescription, tags: editTags.split(',').map((tag) => tag.trim()).filter(Boolean), fields: { [field.key]: editDetail.trim() || undefined } })
      await reload(); setEditing(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить сущность') } finally { setBusy(false) }
  }

  return (
    <main className="target-library">
      <header className="target-library__topbar">
        <div className="row target-demo-links">
          <Link to="/demo/campaign" className="row muted"><Icon name="layout-dashboard" size={16} /> Кампания</Link>
          <Link to="/demo/session" className="row muted"><Icon name="clapperboard" size={16} /> Сессия</Link>
          <Link to="/demo/publications" className="row muted"><Icon name="upload" size={16} /> Публикации</Link>
        </div>
        <Badge tone="neutral" dot>Локальные тестовые данные</Badge>
      </header>

      <section className="target-library__heading">
        <div><span className="panel-kicker">Пространство Лунного порта</span><h1>Библиотека</h1><p>Сущности кампании, их происхождение и рабочий контекст.</p></div>
        <Button variant="primary" icon="plus" onClick={() => { setCreating(true); setInspected(null) }}>Новая сущность</Button>
      </section>
      {error && <p className="local-session-error" role="alert">{error}</p>}

      <section className="target-library__toolbar" aria-label="Фильтры библиотеки">
        <div className="target-library__search"><Icon name="search" size={17} /><input id="target-library-search" name="target-library-search" value={query} placeholder="Поиск по имени или тегу…" onChange={(event) => setQuery(event.target.value)} /></div>
        <Select aria-label="Тип сущности" value={type} onChange={(event) => setType(event.target.value as TargetEntityType | '')} containerStyle={{ marginBottom: 0 }}>
          {TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
        <Select aria-label="Источник сущности" value={origin} onChange={(event) => setOrigin(event.target.value as EntityOrigin | '')} containerStyle={{ marginBottom: 0 }}>
          <option value="">Все источники</option>
          {Object.entries(ORIGIN_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Checkbox label="Архив" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
        <div className="target-library__view" aria-label="Вид библиотеки">
          <button className={view === 'grid' ? 'active' : ''} aria-label="Сетка" onClick={() => setView('grid')}><Icon name="layout-dashboard" size={17} /></button>
          <button className={view === 'list' ? 'active' : ''} aria-label="Список" onClick={() => setView('list')}><Icon name="list-checks" size={17} /></button>
        </div>
        <Button variant={selectMode ? 'soft' : 'secondary'} icon="check" onClick={() => { setSelectMode((value) => !value); setSelectedIds([]) }}>{selectMode ? 'Отменить выбор' : 'Выбрать'}</Button>
      </section>

      {selectMode && (
        <div className="target-library__selection">
          <strong>Выбрано: {selectedIds.length}</strong>
          <Button size="sm" tone="danger" icon="trash-2" disabled={!selectedIds.length || busy} onClick={() => void archiveSelected()}>В архив</Button>
        </div>
      )}

      <div className={`target-library__workspace ${creating || inspected ? 'has-inspector' : ''}`}>
        <section>
          <div className="target-library__count"><span>Показано: {records.length}</span><span>{type ? TYPES.find((item) => item.value === type)?.label : 'Вся библиотека'}</span></div>
          {records.length === 0 ? <EmptyState icon="search-x" title="Ничего не найдено" hint="Измените тип, источник или поисковую фразу." /> : (
            <div className={`target-library__records target-library__records--${view}`}>
              {records.map((record) => {
                const checked = selectedIds.includes(record.id)
                return (
                  <Card
                    key={record.id}
                    as="button"
                    interactive={!selectMode}
                    className={`target-entity-card ${checked ? 'is-selected' : ''}`}
                    padding={view === 'list' ? 'var(--space-3)' : 'var(--space-4)'}
                    onClick={() => openRecord(record)}
                  >
                    <div className="target-entity-card__head">
                      {selectMode && <span className={`target-select-mark ${checked ? 'checked' : ''}`} aria-hidden>{checked ? '✓' : ''}</span>}
                      <div><span className="panel-kicker">{TYPE_LABEL[record.entity.entityType]}</span><strong>{record.entity.name}</strong></div>
                      {record.entity.archived && <Badge tone="neutral" size="sm">В архиве</Badge>}
                    </div>
                    {summary(record) && <p>{summary(record)}</p>}
                    <div className="target-entity-card__badges">
                      {record.origins.map((item) => <Badge key={item} tone={item === 'masterboard' ? 'neutral' : 'accent'} size="sm">{ORIGIN_LABEL[item]}</Badge>)}
                      {record.entity.tags.slice(0, 3).map((tag) => <Badge key={tag} size="sm">#{tag}</Badge>)}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {(creating || inspected) && (
          <aside className="target-library__inspector">
            <button className="target-inspector__close" aria-label="Закрыть инспектор" onClick={() => { setCreating(false); setInspected(null); setEditing(false) }}>×</button>
            {creating ? (
              <>
                <span className="panel-kicker">Ручная сущность</span>
                <h2>Создать в Мастерборде</h2>
                <p className="muted">Запись останется локальной, пока вы явно не подготовите публикацию.</p>
                <label className="field" htmlFor="new-entity-type"><span>Тип</span><select id="new-entity-type" name="new-entity-type" value={createType} onChange={(event) => setCreateType(event.target.value as TargetEntityType)}>{CREATE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label className="field" htmlFor="new-entity-name"><span>Название</span><input id="new-entity-name" name="new-entity-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
                <label className="field" htmlFor="new-entity-description"><span>Рабочее описание</span><textarea id="new-entity-description" name="new-entity-description" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
                <label className="field" htmlFor="new-entity-tags"><span>Теги</span><input id="new-entity-tags" name="new-entity-tags" value={tags} placeholder="улика, гавань" onChange={(event) => setTags(event.target.value)} /></label>
                <div className="row"><Button variant="primary" disabled={!name.trim() || busy} onClick={() => void createEntity()}>Создать сущность</Button><Button variant="ghost" onClick={() => setCreating(false)}>Отмена</Button></div>
              </>
            ) : inspected ? (
              <>
                <span className="panel-kicker">{TYPE_LABEL[inspected.entity.entityType]} · локальная карточка</span>
                {editing ? <div className="target-inspector__edit"><label className="field" htmlFor="edit-entity-name"><span>Название</span><input id="edit-entity-name" name="edit-entity-name" value={editName} onChange={(event) => setEditName(event.target.value)} /></label><label className="field" htmlFor="edit-entity-status"><span>Статус</span><input id="edit-entity-status" name="edit-entity-status" value={editStatus} onChange={(event) => setEditStatus(event.target.value)} /></label><label className="field" htmlFor="edit-entity-description"><span>Рабочее описание</span><textarea id="edit-entity-description" name="edit-entity-description" rows={4} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} /></label><label className="field" htmlFor="edit-entity-detail"><span>{DETAIL_FIELD[inspected.entity.entityType].label}</span><textarea id="edit-entity-detail" name="edit-entity-detail" rows={4} value={editDetail} placeholder={DETAIL_FIELD[inspected.entity.entityType].placeholder} onChange={(event) => setEditDetail(event.target.value)} /></label><label className="field" htmlFor="edit-entity-tags"><span>Теги</span><input id="edit-entity-tags" name="edit-entity-tags" value={editTags} placeholder="через запятую" onChange={(event) => setEditTags(event.target.value)} /></label><div className="row"><Button variant="primary" icon="check" disabled={!editName.trim() || busy} onClick={() => void saveEntity()}>Сохранить</Button><Button variant="ghost" onClick={() => setEditing(false)}>Отмена</Button></div></div> : <><div className="target-inspector__title"><h2>{inspected.entity.name}</h2><Button size="sm" icon="pencil" onClick={startEditing}>Редактировать</Button></div>
                <div className="target-inspector__origins">{inspected.origins.map((item) => <Badge key={item} tone={item === 'masterboard' ? 'neutral' : 'accent'}>{ORIGIN_LABEL[item]}</Badge>)}</div>
                <dl className="target-inspector__facts"><dt>Статус</dt><dd>{inspected.entity.status}</dd><dt>Проекции</dt><dd>{inspected.projectionCount}</dd><dt>Теги</dt><dd>{inspected.entity.tags.length ? inspected.entity.tags.join(', ') : 'Нет'}</dd></dl>
                {summary(inspected) && <div className="target-inspector__section"><span>Рабочий контекст</span><p>{summary(inspected)}</p></div>}
                {inspected.entity[DETAIL_FIELD[inspected.entity.entityType].key] ? <div className="target-inspector__section"><span>{DETAIL_FIELD[inspected.entity.entityType].label}</span><p>{String(inspected.entity[DETAIL_FIELD[inspected.entity.entityType].key])}</p></div> : null}
                {inspected.entity.masterNote ? <div className="target-inspector__section master-only"><span>Правда ведущего</span><p>{String(inspected.entity.masterNote)}</p></div> : null}
                {inspected.entity.publicDraft ? <div className="target-inspector__section"><span>Черновик для игроков</span><p>{String(inspected.entity.publicDraft)}</p></div> : null}
                <p className="muted target-inspector__note">Редактирование и публикация остаются отдельными явными действиями.</p></>}
              </>
            ) : null}
          </aside>
        )}
      </div>
      <p className="local-session-footnote">Ручные изменения остаются в тестовом пространстве этой вкладки и сбрасываются после перезагрузки.</p>
    </main>
  )
}
