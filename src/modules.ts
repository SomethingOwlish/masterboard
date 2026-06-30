// Central registry of campaign modules. The burger menu and the campaign routes
// are both derived from this list so they never drift apart.

export interface ModuleDef {
  id: string
  label: string
  path: string // relative to /campaign/:id
  icon: string // Lucide icon name (kebab-case), rendered via the DS Icon component
  blurb: string
}

export const MODULES: ModuleDef[] = [
  { id: 'overview', label: 'Campaign', path: '', icon: 'layout-dashboard', blurb: 'Dashboard, next-session planner & recap log' },
  { id: 'characters', label: 'Characters', path: 'characters', icon: 'shield', blurb: 'Player characters' },
  { id: 'npcs', label: 'NPCs', path: 'npcs', icon: 'drama', blurb: 'Non-player characters' },
  { id: 'relations', label: 'Relations', path: 'relations', icon: 'waypoints', blurb: 'Who knows whom' },
  { id: 'chronology', label: 'Chronology', path: 'chronology', icon: 'history', blurb: 'In-world timeline' },
  { id: 'sessions', label: 'Sessions', path: 'sessions', icon: 'map', blurb: 'Session planner documents' },
  { id: 'locations', label: 'Locations', path: 'locations', icon: 'map-pin', blurb: 'Places & maps' },
  { id: 'misc', label: 'Misc', path: 'misc', icon: 'dices', blurb: 'Notes, items & custom objects' },
  { id: 'tasks', label: 'Tasks', path: 'tasks', icon: 'list-checks', blurb: 'Task tracker' },
  { id: 'rules', label: 'Rules', path: 'rules', icon: 'book-open', blurb: 'Mechanics & house rules' },
  { id: 'activity', label: 'Log', path: 'log', icon: 'scroll-text', blurb: 'Changelog of edits in this campaign' },
  { id: 'print', label: 'Print', path: 'print', icon: 'printer', blurb: 'Compile a printable session sheet' },
  { id: 'settings', label: 'Settings', path: 'settings', icon: 'settings', blurb: 'Storage, sources, theme' },
]
