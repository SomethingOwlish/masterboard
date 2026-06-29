// Right-side slide-over used for entity detail editing (Characters, NPCs). Closes
// on backdrop click or Escape. Content scrolls; an optional footer pins actions.

import { useEffect, type ReactNode } from 'react'

export function Drawer({
  title,
  onClose,
  children,
  footer,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="drawer-head">
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h2>
          <button className="ghost" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-foot">{footer}</footer>}
      </aside>
    </div>
  )
}
