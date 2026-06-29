// Central registry of campaign modules. The burger menu and the campaign routes
// are both derived from this list so they never drift apart.

export interface ModuleDef {
  id: string
  label: string
  path: string // relative to /campaign/:id
  icon: string // emoji placeholder until an icon set is added
  blurb: string
}

export const MODULES: ModuleDef[] = [
  { id: 'overview', label: 'Campaign', path: '', icon: '🏰', blurb: 'Dashboard, next-session planner & recap log' },
  { id: 'characters', label: 'Characters', path: 'characters', icon: '🛡️', blurb: 'Player characters' },
  { id: 'npcs', label: 'NPCs', path: 'npcs', icon: '🎭', blurb: 'Non-player characters' },
  { id: 'relations', label: 'Relations', path: 'relations', icon: '🕸️', blurb: 'Who knows whom' },
  { id: 'chronology', label: 'Chronology', path: 'chronology', icon: '📜', blurb: 'In-world timeline' },
  { id: 'sessions', label: 'Sessions', path: 'sessions', icon: '🗺️', blurb: 'Session planner documents' },
  { id: 'locations', label: 'Locations', path: 'locations', icon: '📍', blurb: 'Places & maps' },
  { id: 'misc', label: 'Misc', path: 'misc', icon: '🎲', blurb: 'Notes, items & custom objects' },
  { id: 'tasks', label: 'Tasks', path: 'tasks', icon: '✅', blurb: 'Task tracker' },
  { id: 'rules', label: 'Rules', path: 'rules', icon: '📖', blurb: 'Mechanics & house rules' },
  { id: 'print', label: 'Print', path: 'print', icon: '🖨️', blurb: 'Compile a printable session sheet' },
  { id: 'settings', label: 'Settings', path: 'settings', icon: '⚙️', blurb: 'Storage, sources, theme' },
]
