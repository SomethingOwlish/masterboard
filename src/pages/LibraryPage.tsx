import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Card, Checkbox, EmptyState, Icon, Select, TextField } from '../ds'
import { buildLibrary, filterLibrary, type LibraryOrigin, type LibrarySection, type LibrarySearchScope, type LibrarySourceData } from '../lib/library'
import type { ExternalConnection, ExternalProjection } from '../model/external'
import type { Character, Location, Misc, NPC } from '../model/types'
import { data } from '../storage/data'

const SECTIONS: { id: LibrarySection; label: string; icon: string }[] = [
  { id: 'people', label: 'Characters & NPCs', icon: 'users' },
  { id: 'locations', label: 'Locations', icon: 'map-pin' },
  { id: 'misc', label: 'Other', icon: 'shapes' },
]

const ORIGIN_LABEL: Record<LibraryOrigin, string> = {
  masterboard: 'Masterboard', lovegame: 'Lovegame', lorebook: 'Lorebook', systemsetup: 'Systemsetup',
}

const EMPTY_DATA: LibrarySourceData = { characters: [], npcs: [], locations: [], misc: [] }

export function LibraryPage() {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const [source, setSource] = useState<LibrarySourceData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<LibrarySection>('people')
  const [scope, setScope] = useState<LibrarySearchScope>('selected-section')
  const [query, setQuery] = useState('')
  const [origin, setOrigin] = useState<LibraryOrigin | ''>('')
  const [includeArchived, setIncludeArchived] = useState(false)

  useEffect(() => {
    if (!campaignId) return
    let current = true
    setLoading(true)
    void Promise.all([
      data.readModuleArray<Character>(campaignId, 'characters'),
      data.readModuleArray<NPC>(campaignId, 'npcs'),
      data.readModuleArray<Location>(campaignId, 'locations'),
      data.readModuleArray<Misc>(campaignId, 'misc'),
      data.readModuleArray<ExternalConnection>(campaignId, 'connections'),
      data.readModuleArray<ExternalProjection>(campaignId, 'projections'),
    ]).then(([characters, npcs, locations, misc, connections, projections]) => {
      if (!current) return
      setSource({ characters, npcs, locations, misc, connections, projections })
      setLoading(false)
    })
    return () => { current = false }
  }, [campaignId])

  const records = useMemo(() => buildLibrary(source), [source])
  const shown = useMemo(() => filterLibrary(records, {
    section, query, scope, origin: origin || undefined, includeArchived,
  }), [records, section, query, scope, origin, includeArchived])
  const counts = useMemo(() => Object.fromEntries(SECTIONS.map(({ id }) => [
    id, records.filter((record) => record.section === id && (includeArchived || !record.archived)).length,
  ])), [records, includeArchived])

  return (
    <div className="content">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="row" style={{ margin: 0, gap: '0.5rem' }}><Icon name="library" size={24} /> Library</h1>
        <span className="muted">{shown.length} shown</span>
      </div>

      <div className="library-layout">
        <Card padding="var(--space-3)" style={{ alignSelf: 'start' }}>
          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Types</strong>
          <div style={{ display: 'grid', gap: 4 }}>
            {SECTIONS.map((item) => (
              <button key={item.id} type="button" onClick={() => setSection(item.id)} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '0.65rem 0.75rem',
                border: 0, borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
                color: section === item.id ? 'var(--accent-contrast)' : 'var(--text)',
                background: section === item.id ? 'var(--accent)' : 'transparent',
              }}>
                <Icon name={item.icon} size={17} /> <span style={{ flex: 1 }}>{item.label}</span>
                <span>{counts[item.id] ?? 0}</span>
              </button>
            ))}
          </div>
        </Card>

        <div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <TextField
              aria-label="Search library" icon="search" placeholder="Search name or tag…"
              value={query} onChange={(event) => setQuery(event.target.value)}
              containerStyle={{ flex: '1 1 260px', marginBottom: 0 }}
            />
            <Select value={scope} onChange={(event) => setScope(event.target.value as LibrarySearchScope)} containerStyle={{ minWidth: 180, marginBottom: 0 }}>
              <option value="selected-section">Selected type</option>
              <option value="all-library">Entire library</option>
            </Select>
            <Select value={origin} onChange={(event) => setOrigin(event.target.value as LibraryOrigin | '')} containerStyle={{ minWidth: 160, marginBottom: 0 }}>
              <option value="">All origins</option>
              {Object.entries(ORIGIN_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Checkbox label="Show archive" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
          </div>

          {loading ? <p className="muted" style={{ marginTop: '1rem' }}>Loading…</p> : shown.length === 0 ? (
            <EmptyState icon="search-x" title="Nothing found" hint="Try another type, origin, or search scope." style={{ marginTop: '1rem' }} />
          ) : (
            <div className="grid entity-grid" style={{ marginTop: '1rem' }}>
              {shown.map((record) => (
                <Card key={`${record.kind}:${record.id}`} interactive as="button" onClick={() => navigate(record.route)} style={{ textAlign: 'left', cursor: 'pointer' }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ display: 'block' }}>{record.name || '(unnamed)'}</strong>
                      <span className="muted" style={{ fontSize: '0.85rem' }}>{record.kindLabel}{record.secondary ? ` · ${record.secondary}` : ''}</span>
                    </div>
                    {record.archived && <Badge tone="neutral" size="sm">Archived</Badge>}
                  </div>
                  {(record.tags.length > 0 || record.origins.length > 0) && (
                    <div className="row" style={{ marginTop: '0.75rem', gap: 6 }}>
                      {record.origins.map((item) => <Badge key={item} tone={item === 'masterboard' ? 'neutral' : 'accent'} size="sm">{ORIGIN_LABEL[item]}</Badge>)}
                      {record.tags.map((tag) => <Badge key={tag} size="sm">#{tag}</Badge>)}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
