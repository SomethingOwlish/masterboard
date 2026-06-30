// Per-module storage settings (M1 / B12, DESIGN.md §3). The app's architecture
// already fixes where each kind of data lives — repo JSON files, Imgur for images,
// rules as standalone markdown, source sites read-only — so this panel surfaces that
// map transparently and exposes the one override that's safe and actually honored:
// marking a content module READ-ONLY. A locked module is never written back (see
// data.isLocked), which protects data fed by an import from being overwritten.

import type { ModuleId } from '../model/types'
import { useCampaign } from '../store/campaign'
import { useToast } from './useToast'
import { Icon, Switch } from '../ds'

// Content modules the GM can lock read-only, with a friendly label + icon.
const LOCKABLE: { mod: ModuleId; label: string; icon: string }[] = [
  { mod: 'characters', label: 'Characters', icon: 'shield' },
  { mod: 'npcs', label: 'NPCs', icon: 'drama' },
  { mod: 'locations', label: 'Locations', icon: 'map-pin' },
  { mod: 'misc', label: 'Misc', icon: 'dices' },
  { mod: 'relations', label: 'Relations', icon: 'waypoints' },
  { mod: 'timeline', label: 'Chronology', icon: 'history' },
  { mod: 'log', label: 'Recap log', icon: 'scroll-text' },
  { mod: 'tasks', label: 'Tasks', icon: 'list-checks' },
]

export function StoragePanel() {
  const campaign = useCampaign((s) => s.campaign)
  const updateSettings = useCampaign((s) => s.updateSettings)
  const toast = useToast()
  if (!campaign) return null

  const storage = campaign.settings.storage ?? {}

  const setLocked = (mod: ModuleId, locked: boolean) => {
    void updateSettings({ storage: { ...storage, [mod]: locked ? 'source-readonly' : 'repo-file' } })
    toast({ message: locked ? 'Module locked — read-only' : 'Module unlocked', tone: locked ? 'neutral' : 'success' })
  }

  return (
    <section className="card storage-panel">
      <h2 className="row" style={{ marginTop: 0, gap: '0.5rem' }}>
        <Icon name="hard-drive" size={20} /> Storage
      </h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Each module is saved as a JSON file in your campaign folder. Lock one to read-only and the app
        stops writing to it — useful when its data is fed by an import you don't want overwritten.
      </p>

      <ul className="storage-list">
        {LOCKABLE.map(({ mod, label, icon }) => {
          const locked = storage[mod] === 'source-readonly'
          return (
            <li key={mod} className="storage-row">
              <span className="row" style={{ gap: '0.5rem', minWidth: 0 }}>
                <Icon name={icon} size={16} />
                <span className="storage-label">{label}</span>
                <span className="storage-backend">{locked ? 'read-only' : 'repo file'}</span>
              </span>
              <Switch checked={locked} label="Read-only" onChange={(e) => setLocked(mod, e.target.checked)} />
            </li>
          )
        })}
      </ul>

      <p className="muted storage-note">
        Rules are stored as standalone markdown (<code>rules.md</code>); images upload to Imgur; connected
        source sites are always read-only. Those backends are fixed by the kind of data they hold.
      </p>
    </section>
  )
}
