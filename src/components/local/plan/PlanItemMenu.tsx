import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../../../ds'

/**
 * «…» next to a plan item while the session is played (ТЗ-3, этап 11): the row
 * keeps only the status and the title, the rest of the controls open here.
 * A disclosure, not an ARIA menu — it holds selects as well as buttons.
 */
export function PlanItemMenu({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      root.current?.querySelector<HTMLButtonElement>('.plan-item-menu__toggle')?.focus()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
  return <div
    ref={root}
    className="plan-item-menu"
    onDragStart={(event) => event.preventDefault()}
  >
    <button
      type="button"
      className="plan-item-menu__toggle"
      aria-expanded={open}
      aria-label={`Действия: ${title}`}
      title="Действия"
      onClick={() => setOpen(!open)}
    >
      <Icon name="ellipsis" size={16} />
    </button>
    {open && <div
      className="plan-item-menu__panel"
      role="group"
      aria-label={`Действия: ${title}`}
    >
      {children}
    </div>}
  </div>
}
