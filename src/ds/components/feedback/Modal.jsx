import React from 'react'
import { IconButton } from '../core/IconButton'
import { Icon } from '../core/Icon'
import { Button } from '../core/Button'

/**
 * Modal — a centered dialog over a blurred scrim. The one dialog primitive of
 * Masterboard: editors, quick-add forms, confirmations.
 *
 * Keyboard: focus moves inside on open (`initialFocus`, else an `autoFocus`
 * field, else the first field, else a `data-autofocus` control, else the first
 * control) and stays inside —
 * Tab and Shift+Tab wrap. Escape anywhere on the page closes the topmost
 * dialog only. On close focus returns to the control that opened it.
 *
 * `dirty` — the dialog holds unsaved edits: Escape, a scrim click and «×» ask
 * «Закрыть без сохранения?» first. Explicit buttons in the dialog (Cancel)
 * call their own handlers and are not asked about.
 *
 * Sizes sm | md | lg | xl. Compose ModalFooter for actions.
 */
export function Modal({
  open = true,
  onClose,
  title,
  subtitle,
  kicker,
  icon,
  size = 'md',
  children,
  footer,
  dismissable = true,
  dirty = false,
  initialFocus,
  closeLabel = 'Закрыть',
  className,
  style,
  ...rest
}) {
  if (!open) return null
  return (
    <ModalWindow
      {...{ onClose, title, subtitle, kicker, icon, size, footer, dismissable, dirty, initialFocus, closeLabel, className, style, rest }}
    >
      {children}
    </ModalWindow>
  )
}

/** Open dialogs, bottom to top: only the top one answers Escape and traps Tab. */
const layers = []

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, iframe, [contenteditable="true"], [tabindex]'
const FIELD = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea'

function reachable(el) {
  if (el.disabled || el.getAttribute('tabindex') === '-1' || el.closest('[hidden], [inert]')) return false
  const details = el.closest('details:not([open])')
  return !details || (el.tagName === 'SUMMARY' && el.parentElement === details)
}

function focusables(root, selector = FOCUSABLE) {
  return Array.from(root.querySelectorAll(selector)).filter(reachable)
}

function ModalWindow({ onClose, title, subtitle, kicker, icon, size, children, footer, dismissable, dirty, initialFocus, closeLabel, className, style, rest }) {
  const panel = React.useRef(null)
  const titleId = React.useId()
  // Captured during the first render, before any `autoFocus` inside moves focus.
  const [opener] = React.useState(() => (typeof document === 'undefined' ? null : document.activeElement))
  const [asking, setAsking] = React.useState(false)
  const latest = React.useRef({})
  latest.current = { onClose, dismissable, dirty, asking }

  const dismiss = React.useCallback(() => {
    const { onClose: close, dismissable: can, dirty: unsaved } = latest.current
    if (!can || !close) return
    if (unsaved) setAsking(true)
    else close()
  }, [])

  React.useEffect(() => {
    const token = {}
    layers.push(token)
    const node = panel.current
    if (node && !node.contains(document.activeElement)) {
      const target = initialFocus?.current ?? focusables(node, FIELD)[0] ?? focusables(node, '[data-autofocus]')[0] ?? focusables(node)[0] ?? node
      target.focus({ preventScroll: true })
    }
    const onKey = (event) => {
      if (layers[layers.length - 1] !== token || latest.current.asking) return
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        dismiss()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const items = focusables(node)
      if (!items.length) {
        event.preventDefault()
        node.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const inside = node.contains(document.activeElement)
      if (event.shiftKey && (!inside || document.activeElement === first || document.activeElement === node)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      layers.splice(layers.indexOf(token), 1)
      // Still in the page: StrictMode's rehearsal unmount, not a real close.
      if (node?.isConnected) return
      // Give focus back unless the page has already moved it somewhere real.
      const now = document.activeElement
      if (opener && opener !== document.body && opener.isConnected && (!now || now === document.body || node?.contains(now))) {
        opener.focus({ preventScroll: true })
      }
    }
    // Mount-only: focus and the Escape/Tab listener belong to this window's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const widths = { sm: 380, md: 480, lg: 620, xl: 820, full: 980 }
  const w = widths[size] || widths.md

  return (
    <>
      <div
        className="mb-modal-scrim"
        onMouseDown={(e) => {
          if (e.target !== e.currentTarget) return
          // Keep focus where it was: if the dialog asks first, the edit goes on from there.
          e.preventDefault()
          dismiss()
        }}
      >
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          className={`mb-modal mb-sheen${className ? ` ${className}` : ''}`}
          style={{ maxWidth: w, ...style }}
          {...rest}
        >
          {(title || icon) && (
            <header className="mb-modal__head">
              {icon && (
                <span className="mb-modal__icon">
                  <Icon name={icon} size={20} />
                </span>
              )}
              <div className="mb-modal__titles">
                {kicker && <span className="mb-modal__kicker">{kicker}</span>}
                {title && <h2 id={titleId} className="mb-modal__title">{title}</h2>}
                {subtitle && <p className="mb-modal__subtitle">{subtitle}</p>}
              </div>
              {dismissable && onClose && (
                <IconButton
                  icon="x"
                  label={closeLabel}
                  onClick={dismiss}
                />
              )}
            </header>
          )}
          <div className={`mb-modal__body${title ? '' : ' mb-modal__body--bare'}`}>{children}</div>
          {footer && <footer className="mb-modal__foot">{footer}</footer>}
        </div>
      </div>
      {asking && (
        <Modal
          size="md"
          icon="triangle-alert"
          title="Закрыть без сохранения?"
          onClose={() => setAsking(false)}
          footer={
            <>
              <Button
                variant="ghost"
                data-autofocus
                onClick={() => setAsking(false)}
              >
                Продолжить правку
              </Button>
              <Button
                variant="primary"
                tone="danger"
                onClick={() => { setAsking(false); onClose?.() }}
              >
                Закрыть без сохранения
              </Button>
            </>
          }
        >
          <p className="mb-modal__message">Изменения в этом окне не сохранены и пропадут.</p>
        </Modal>
      )}
    </>
  )
}
