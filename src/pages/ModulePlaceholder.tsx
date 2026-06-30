import { MODULES } from '../modules'
import { Icon, EmptyState } from '../ds'

// Fallback stub for any module without a real element yet (all ship today, so
// this is just a safety net for routing). Uses the calm DS EmptyState.
export function ModulePlaceholder({ moduleId }: { moduleId: string }) {
  const mod = MODULES.find((m) => m.id === moduleId)
  if (!mod) return <div className="content">Unknown module.</div>

  return (
    <div className="content">
      <h1 className="row" style={{ marginTop: 0, gap: '0.5rem' }}>
        <Icon name={mod.icon} size={24} /> {mod.label}
      </h1>
      <p className="muted">{mod.blurb}</p>
      <EmptyState
        icon={mod.icon}
        title="Coming soon"
        hint="This module is specified in DESIGN.md and will be built in its scheduled batch. The shell, routing, theming, and responsive layout around it are live now."
        style={{ maxWidth: 560 }}
      />
    </div>
  )
}
