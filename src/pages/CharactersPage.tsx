// Characters module (M3 / B3): player-character roster. Card grid + a detail
// drawer for the custom-field engine, tags, portrait, and connections. Creating a
// character opens its drawer immediately so every edit autosaves through the store.

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useFocusParam, useNewAction } from '../lib/shortcuts'
import { Drawer } from '../components/Drawer'
import { FieldsEditor } from '../components/FieldsEditor'
import { TagEditor } from '../components/TagEditor'
import { ConnectionsEditor } from '../components/ConnectionsEditor'
import { ImageField } from '../components/ImageField'
import { EntityTaskButton } from '../components/EntityTaskButton'
import { makeCharacter } from '../model/defaults'
import { useCampaign } from '../store/campaign'
import { useEntityPool } from '../store/entities'

export function CharactersPage() {
  const { campaignId } = useParams()
  const characters = useCampaign((s) => s.characters)
  const addCharacter = useCampaign((s) => s.addCharacter)
  const updateCharacter = useCampaign((s) => s.updateCharacter)
  const deleteCharacter = useCampaign((s) => s.deleteCharacter)

  const [openId, setOpenId] = useState<string | null>(null)

  // The cross-module pool (PCs/NPCs/Locations/Misc) + relations power the
  // connections editor inside the drawer.
  const entities = useEntityPool(campaignId)

  const editing = characters.find((c) => c.id === openId) ?? null

  async function create() {
    const c = makeCharacter()
    await addCharacter(c)
    setOpenId(c.id)
  }

  useFocusParam(setOpenId)
  useNewAction(() => void create())

  return (
    <div className="content">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>
          <span aria-hidden>🛡️</span> Characters
        </h1>
        <button className="primary" onClick={() => void create()}>
          + New character
        </button>
      </div>

      {characters.length === 0 ? (
        <p className="muted">No player characters yet. Add the party with “New character”.</p>
      ) : (
        <div className="grid entity-grid" style={{ marginTop: '1rem' }}>
          {characters.map((c) => (
            <button key={c.id} className="card entity-card" onClick={() => setOpenId(c.id)}>
              <div className="entity-head">
                {c.portrait ? (
                  <img className="avatar" src={c.portrait} alt="" />
                ) : (
                  <span className="avatar avatar-empty" aria-hidden>🛡️</span>
                )}
                <div className="entity-title">
                  <strong>{c.name || '(unnamed)'}</strong>
                  {c.playerName && <div className="muted">{c.playerName}</div>}
                </div>
              </div>
              {c.tags.length > 0 && (
                <div className="chips">
                  {c.tags.map((t) => (
                    <span key={t} className="chip">{t}</span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {editing && (
        <Drawer
          title={editing.name || 'New character'}
          onClose={() => setOpenId(null)}
          footer={
            <>
              <button
                onClick={() => {
                  void deleteCharacter(editing.id)
                  setOpenId(null)
                }}
              >
                Delete
              </button>
              <button className="primary" onClick={() => setOpenId(null)}>
                Done
              </button>
            </>
          }
        >
          <div className="field">
            <label>Name</label>
            <input value={editing.name} onChange={(e) => void updateCharacter(editing.id, { name: e.target.value })} />
          </div>
          <div className="field">
            <label>Player name</label>
            <input
              value={editing.playerName ?? ''}
              onChange={(e) => void updateCharacter(editing.id, { playerName: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Portrait</label>
            <ImageField
              value={editing.portrait}
              variant="avatar"
              glyph="🛡️"
              onChange={(portrait) => void updateCharacter(editing.id, { portrait })}
            />
          </div>

          <h3 className="section-title">Fields</h3>
          <FieldsEditor fields={editing.fields} onChange={(fields) => void updateCharacter(editing.id, { fields })} />

          <h3 className="section-title" style={{ marginTop: '1rem' }}>Tags</h3>
          <TagEditor tags={editing.tags} onChange={(tags) => void updateCharacter(editing.id, { tags })} />

          <h3 className="section-title" style={{ marginTop: '1rem' }}>Connections</h3>
          <ConnectionsEditor entityId={editing.id} entities={entities} />

          <h3 className="section-title" style={{ marginTop: '1rem' }}>Tasks</h3>
          <EntityTaskButton campaignId={campaignId} entityId={editing.id} entityName={editing.name} kind="pc" />
        </Drawer>
      )}
    </div>
  )
}
