// Global keyboard-shortcut plumbing (B10). The "new entity" shortcut (`n`) is
// decoupled: the campaign layout owns the key handling but doesn't know how each
// module creates things, so it broadcasts an event and whichever list page is
// mounted reacts. Keeps the layout free of per-module knowledge.

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

const NEW_EVENT = 'masterboard:new'

/**
 * Open the entity the command palette deep-linked to. A page calls this with its
 * drawer-open setter; when the URL carries `?focus=<id>` we open that record and
 * strip the param so closing the drawer doesn't reopen it.
 */
export function useFocusParam(onFocus: (id: string) => void): void {
  const [params, setParams] = useSearchParams()
  const ref = useRef(onFocus)
  ref.current = onFocus
  useEffect(() => {
    const id = params.get('focus')
    if (!id) return
    ref.current(id)
    const next = new URLSearchParams(params)
    next.delete('focus')
    setParams(next, { replace: true })
  }, [params, setParams])
}

/** Fired by the layout when the user presses `n` outside a text field. */
export function emitNewAction(): void {
  window.dispatchEvent(new Event(NEW_EVENT))
}

/** A list page registers its "create" handler; runs when `n` is pressed. */
export function useNewAction(handler: () => void): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const fn = () => ref.current()
    window.addEventListener(NEW_EVENT, fn)
    return () => window.removeEventListener(NEW_EVENT, fn)
  }, [])
}

/** True when focus is in a text field — global single-key shortcuts must defer. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}
