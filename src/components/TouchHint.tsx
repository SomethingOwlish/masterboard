// A one-time affordance for touch users on the pan/zoom canvases (B10). React Flow
// canvases are awkward on first touch, so we surface a hint until dismissed. CSS
// hides it entirely on fine-pointer (mouse) devices; here we also let the user
// dismiss it and remember that across sessions.

import { useState } from 'react'
import { Icon } from '../ds'

const KEY = 'masterboard:touch-hint-dismissed'

export function TouchHint({ text }: { text: string }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })
  if (dismissed) return null
  return (
    <div className="touch-hint no-print">
      <Icon name="pointer" size={15} /> {text}
      <button
        aria-label="Dismiss hint"
        onClick={() => {
          setDismissed(true)
          try {
            localStorage.setItem(KEY, '1')
          } catch {
            /* private mode — dismiss for this view only */
          }
        }}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}
