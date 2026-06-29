import { MODULES } from '../modules'

// Every module renders this stub in Batch 0 so navigation, the burger menu, and
// routing can be verified before feature work lands in later batches.
export function ModulePlaceholder({ moduleId }: { moduleId: string }) {
  const mod = MODULES.find((m) => m.id === moduleId)
  if (!mod) return <div className="content">Unknown module.</div>

  return (
    <div className="content">
      <h1 style={{ marginTop: 0 }}>
        <span aria-hidden>{mod.icon}</span> {mod.label}
      </h1>
      <p className="muted">{mod.blurb}</p>
      <div className="card" style={{ maxWidth: 560 }}>
        <strong>Coming soon</strong>
        <p className="muted" style={{ marginBottom: 0 }}>
          This module is specified in <code>DESIGN.md</code> (M-section) and will be built in its
          scheduled batch. The shell, routing, theming, and responsive layout around it are live now.
        </p>
      </div>
    </div>
  )
}
