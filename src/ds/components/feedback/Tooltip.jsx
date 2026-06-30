import React from 'react'

/**
 * Tooltip — a calm hover/focus label for icon buttons and truncated text.
 * Pure CSS-positioned bubble on a small delay. Wrap any trigger element.
 */
export function Tooltip({ label, side = 'top', children, style, ...rest }) {
  const [show, setShow] = React.useState(false)
  const timer = React.useRef(null)
  const enter = () => { timer.current = setTimeout(() => setShow(true), 280) }
  const leave = () => { clearTimeout(timer.current); setShow(false) }

  const pos = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%) translateY(-7px)' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%) translateY(7px)' },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%) translateX(-7px)' },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%) translateX(7px)' },
  }[side]

  return (
    <span
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={leave}
      style={{ position: 'relative', display: 'inline-flex', ...style }}
      {...rest}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            ...pos,
            zIndex: 'var(--z-tooltip)',
            whiteSpace: 'nowrap',
            padding: '5px 9px',
            background: 'var(--text)',
            color: 'var(--bg)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 'var(--weight-medium)',
            fontSize: 'var(--text-2xs)',
            borderRadius: 'var(--radius-xs)',
            boxShadow: 'var(--shadow)',
            pointerEvents: 'none',
            animation: 'mbFade var(--dur-fast) var(--ease-out)',
          }}
        >
          {label}
        </span>
      )}
    </span>
  )
}
