import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Checkbox, EmptyState, Icon, Select } from '../ds'
import { localLibraryDemo } from '../fixtures/localDemoRuntime'
import type { EntityLibraryRecord, EntityOrigin, TargetEntityType } from '../storage/entityLibrary'

const TYPES: Array<{ value: TargetEntityType | ''; label: string }> = [
  { value: '', label: 'All types' },
  { value: 'character', label: 'Characters' },
  { value: 'npc', label: 'NPCs' },
  { value: 'location', label: 'Locations' },
  { value: 'faction', label: 'Factions' },
  { value: 'rumor', label: 'Rumors' },
  { value: 'item', label: 'Items' },
  { value: 'note', label: 'Notes' },
]

const CREATE_TYPES = TYPES.filter((item) => item.value !== '') as Array<{ value: TargetEntityType; label: string }>
const ORIGIN_LABEL: Record<EntityOrigin, string> = {
  masterboard: 'Masterboard', lovegame: 'Lovegame', lorebook: 'Lorebook', systemsetup: 'Systemsetup',
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
    }
  }

  return (
    <main className="target-library">
      <header className="target-library__topbar">
        <div className="row target-demo-links">
          <Link to="/demo/campaign" className="row muted"><Icon name="layout-dashboard" size={16} /> Dashboard</Link>
          <Link to="/demo/session" className="row muted"><Icon name="clapperboard" size={16} /> Session</Link>
          <Link to="/demo/publications" className="row muted"><Icon name="upload" size={16} /> Publications</Link>
        </div>
        <Badge tone="neutral" dot>Local fake workspace</Badge>
      </header>

      <section className="target-library__heading">
        <div><span className="panel-kicker">Moon Port workspace</span><h1>Library</h1><p>Campaign entities, their origin, and local working context.</p></div>
        <Button variant="primary" icon="plus" onClick={() => { setCreating(true); setInspected(null) }}>New entity</Button>
      </section>
      {error && <p className="local-session-error" role="alert">{error}</p>}

      <section className="target-library__toolbar" aria-label="Library filters">
        <div className="target-library__search"><Icon name="search" size={17} /><input id="target-library-search" name="target-library-search" value={query} placeholder="Search name or tag…" onChange={(event) => setQuery(event.target.value)} /></div>
        <Select aria-label="Entity type" value={type} onChange={(event) => setType(event.target.value as TargetEntityType | '')} containerStyle={{ marginBottom: 0 }}>
          {TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
        <Select aria-label="Entity origin" value={origin} onChange={(event) => setOrigin(event.target.value as EntityOrigin | '')} containerStyle={{ marginBottom: 0 }}>
          <option value="">All origins</option>
          {Object.entries(ORIGIN_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Checkbox label="Archive" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
        <div className="target-library__view" aria-label="View mode">
          <button className={view === 'grid' ? 'active' : ''} aria-label="Grid view" onClick={() => setView('grid')}><Icon name="layout-dashboard" size={17} /></button>
          <button className={view === 'list' ? 'active' : ''} aria-label="List view" onClick={() => setView('list')}><Icon name="list-checks" size={17} /></button>
        </div>
        <Button variant={selectMode ? 'soft' : 'secondary'} icon="check" onClick={() => { setSelectMode((value) => !value); setSelectedIds([]) }}>{selectMode ? 'Cancel select' : 'Select'}</Button>
      </section>

      {selectMode && (
        <div className="target-library__selection">
          <strong>{selectedIds.length} selected</strong>
          <Button size="sm" tone="danger" icon="trash-2" disabled={!selectedIds.length || busy} onClick={() => void archiveSelected()}>Archive selected</Button>
        </div>
      )}

      <div className={`target-library__workspace ${creating || inspected ? 'has-inspector' : ''}`}>
        <section>
          <div className="target-library__count"><span>{records.length} shown</span><span>{type ? TYPES.find((item) => item.value === type)?.label : 'Entire library'}</span></div>
          {records.length === 0 ? <EmptyState icon="search-x" title="Nothing found" hint="Try another type, origin, or search phrase." /> : (
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
                      <div><span className="panel-kicker">{record.entity.entityType}</span><strong>{record.entity.name}</strong></div>
                      {record.entity.archived && <Badge tone="neutral" size="sm">Archived</Badge>}
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
            <button className="target-inspector__close" aria-label="Close inspector" onClick={() => { setCreating(false); setInspected(null) }}>×</button>
            {creating ? (
              <>
                <span className="panel-kicker">Manual entity</span>
                <h2>Create in Masterboard</h2>
                <p className="muted">This stays local until you deliberately prepare a publication.</p>
                <label className="field" htmlFor="new-entity-type"><span>Type</span><select id="new-entity-type" name="new-entity-type" value={createType} onChange={(event) => setCreateType(event.target.value as TargetEntityType)}>{CREATE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label className="field" htmlFor="new-entity-name"><span>Name</span><input id="new-entity-name" name="new-entity-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
                <label className="field" htmlFor="new-entity-description"><span>Working description</span><textarea id="new-entity-description" name="new-entity-description" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
                <label className="field" htmlFor="new-entity-tags"><span>Tags</span><input id="new-entity-tags" name="new-entity-tags" value={tags} placeholder="clue, harbor" onChange={(event) => setTags(event.target.value)} /></label>
                <div className="row"><Button variant="primary" disabled={!name.trim() || busy} onClick={() => void createEntity()}>Create entity</Button><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button></div>
              </>
            ) : inspected ? (
              <>
                <span className="panel-kicker">{inspected.entity.entityType} · local card</span>
                <h2>{inspected.entity.name}</h2>
                <div className="target-inspector__origins">{inspected.origins.map((item) => <Badge key={item} tone={item === 'masterboard' ? 'neutral' : 'accent'}>{ORIGIN_LABEL[item]}</Badge>)}</div>
                <dl className="target-inspector__facts"><dt>Status</dt><dd>{inspected.entity.status}</dd><dt>Projections</dt><dd>{inspected.projectionCount}</dd><dt>Tags</dt><dd>{inspected.entity.tags.length ? inspected.entity.tags.join(', ') : 'None'}</dd></dl>
                {summary(inspected) && <div className="target-inspector__section"><span>Working context</span><p>{summary(inspected)}</p></div>}
                {inspected.entity.masterNote ? <div className="target-inspector__section master-only"><span>Master truth</span><p>{String(inspected.entity.masterNote)}</p></div> : null}
                {inspected.entity.publicDraft ? <div className="target-inspector__section"><span>Player-facing draft</span><p>{String(inspected.entity.publicDraft)}</p></div> : null}
                <p className="muted target-inspector__note">Editing and publication remain separate explicit actions.</p>
              </>
            ) : null}
          </aside>
        )}
      </div>
      <p className="local-session-footnote">Manual changes stay in this in-memory workspace and reset on reload.</p>
    </main>
  )
}
