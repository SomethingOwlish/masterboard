// The freehand annotation layer (B11). React Flow draws scenes/tokens/arrows;
// this transparent SVG sits on top and draws everything else — pen, highlighter,
// shapes, free text, free-floating arrows and emoji stickers. It's authored in
// flow coordinates and rendered inside a <g> carrying React Flow's pan/zoom
// transform, so ink stays glued to the board.
//
// Pointer gating: the layer only swallows pointer events while a draw tool is
// active (`active`); in Select mode it's pointer-transparent so React Flow gets
// the events. Wheel is forwarded to React Flow so zoom keeps working mid-draw.

import { useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent } from 'react'
import { useReactFlow, useViewport } from '@xyflow/react'
import { newId } from '../../model/ids'
import type { Drawing, DrawTool, Point, ShapeKind } from '../../lib/board'

interface Props {
  active: boolean
  tool: DrawTool
  color: string
  width: number
  shapeKind: ShapeKind
  sticker: string
  drawings: Drawing[]
  onCommit: (d: Drawing) => void
  onErase: (ids: string[]) => void
}

// --- geometry ---------------------------------------------------------------

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function boundsOf(d: Drawing): { x: number; y: number; w: number; h: number } {
  if (d.points && d.points.length) {
    const xs = d.points.map((p) => p.x)
    const ys = d.points.map((p) => p.y)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
  }
  if (d.kind === 'text' || d.kind === 'sticker') {
    const fs = d.fontSize ?? 24
    const w = Math.max(fs, (d.text?.length ?? 1) * fs * 0.62)
    return { x: d.x ?? 0, y: (d.y ?? 0) - fs, w, h: fs * 1.3 }
  }
  return { x: d.x ?? 0, y: d.y ?? 0, w: d.w ?? 0, h: d.h ?? 0 }
}

/** Whether a flow-space point hits a drawing, within a zoom-aware tolerance. */
function hits(d: Drawing, p: Point, tol: number): boolean {
  if (d.kind === 'pen' || d.kind === 'highlighter' || d.kind === 'arrow') {
    const pts = d.points ?? []
    const t = Math.max(tol, d.width)
    for (let i = 1; i < pts.length; i++) if (distToSegment(p, pts[i - 1], pts[i]) <= t) return true
    return pts.length === 1 ? Math.hypot(p.x - pts[0].x, p.y - pts[0].y) <= t : false
  }
  const b = boundsOf(d)
  return p.x >= b.x - tol && p.x <= b.x + b.w + tol && p.y >= b.y - tol && p.y <= b.y + b.h + tol
}

function normalizeBox(d: Drawing): Drawing {
  const x = Math.min(d.x ?? 0, (d.x ?? 0) + (d.w ?? 0))
  const y = Math.min(d.y ?? 0, (d.y ?? 0) + (d.h ?? 0))
  return { ...d, x, y, w: Math.abs(d.w ?? 0), h: Math.abs(d.h ?? 0) }
}

function pathOf(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

// --- rendering --------------------------------------------------------------

function Arrowhead({ a, b, color, width }: { a: Point; b: Point; color: string; width: number }) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x)
  const len = 6 + width * 2.2
  const spread = Math.PI / 7
  const p1 = { x: b.x - len * Math.cos(ang - spread), y: b.y - len * Math.sin(ang - spread) }
  const p2 = { x: b.x - len * Math.cos(ang + spread), y: b.y - len * Math.sin(ang + spread) }
  return <polygon points={`${b.x},${b.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`} fill={color} />
}

function Shape({ d }: { d: Drawing }) {
  const common = { fill: 'none', stroke: d.color, strokeWidth: d.width }
  if (d.shape === 'ellipse') {
    return <ellipse cx={(d.x ?? 0) + (d.w ?? 0) / 2} cy={(d.y ?? 0) + (d.h ?? 0) / 2} rx={Math.abs(d.w ?? 0) / 2} ry={Math.abs(d.h ?? 0) / 2} {...common} />
  }
  if (d.shape === 'line') {
    return <line x1={d.x} y1={d.y} x2={(d.x ?? 0) + (d.w ?? 0)} y2={(d.y ?? 0) + (d.h ?? 0)} {...common} strokeLinecap="round" />
  }
  return <rect x={d.x} y={d.y} width={Math.abs(d.w ?? 0)} height={Math.abs(d.h ?? 0)} rx={4} {...common} />
}

function Render({ d }: { d: Drawing }) {
  switch (d.kind) {
    case 'pen':
      return <path d={pathOf(d.points ?? [])} fill="none" stroke={d.color} strokeWidth={d.width} strokeLinecap="round" strokeLinejoin="round" />
    case 'highlighter':
      return <path d={pathOf(d.points ?? [])} fill="none" stroke={d.color} strokeWidth={d.width} strokeLinecap="round" strokeLinejoin="round" opacity={0.35} />
    case 'arrow': {
      const [a, b] = d.points ?? []
      if (!a || !b) return null
      return (
        <g>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={d.color} strokeWidth={d.width} strokeLinecap="round" />
          <Arrowhead a={a} b={b} color={d.color} width={d.width} />
        </g>
      )
    }
    case 'shape':
      return <Shape d={d} />
    case 'text':
      return <text x={d.x} y={d.y} fill={d.color} fontSize={d.fontSize ?? 24} fontFamily="var(--font-sans)" dominantBaseline="hanging">{d.text}</text>
    case 'sticker':
      return <text x={d.x} y={d.y} fontSize={d.fontSize ?? 32} dominantBaseline="hanging">{d.text}</text>
    default:
      return null
  }
}

export function DrawLayer({ active, tool, color, width, shapeKind, sticker, drawings, onCommit, onErase }: Props) {
  const { screenToFlowPosition, flowToScreenPosition, getViewport, setViewport } = useReactFlow()
  const { x: vx, y: vy, zoom } = useViewport()
  const [draft, setDraft] = useState<Drawing | null>(null)
  const [textAt, setTextAt] = useState<Point | null>(null)
  const [textValue, setTextValue] = useState('')
  const drawing = useRef(false)

  const toFlow = (e: RPointerEvent): Point => screenToFlowPosition({ x: e.clientX, y: e.clientY })

  const eraseAt = (p: Point) => {
    const tol = 8 / zoom
    const hit = drawings.filter((d) => hits(d, p, tol)).map((d) => d.id)
    if (hit.length) onErase(hit)
  }

  const onPointerDown = (e: RPointerEvent) => {
    if (!active || e.button !== 0) return
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId)
    } catch {
      // A pointer that's already released (or a synthetic event) can't be
      // captured — drawing still works, capture is only a nicety.
    }
    const p = toFlow(e)
    const base = { id: newId('draw'), color, width }
    switch (tool) {
      case 'pen':
      case 'highlighter':
        drawing.current = true
        setDraft({ ...base, kind: tool, points: [p] })
        break
      case 'arrow':
        drawing.current = true
        setDraft({ ...base, kind: 'arrow', points: [p, p] })
        break
      case 'shape':
        drawing.current = true
        setDraft({ ...base, kind: 'shape', shape: shapeKind, x: p.x, y: p.y, w: 0, h: 0 })
        break
      case 'sticker':
        onCommit({ ...base, kind: 'sticker', x: p.x, y: p.y, text: sticker, fontSize: 34 })
        break
      case 'text':
        setTextValue('')
        setTextAt(p)
        break
      case 'eraser':
        drawing.current = true
        eraseAt(p)
        break
    }
  }

  const onPointerMove = (e: RPointerEvent) => {
    if (!active || !drawing.current) return
    const p = toFlow(e)
    if (tool === 'pen' || tool === 'highlighter') {
      setDraft((d) => (d ? { ...d, points: [...(d.points ?? []), p] } : d))
    } else if (tool === 'arrow') {
      setDraft((d) => (d ? { ...d, points: [d.points![0], p] } : d))
    } else if (tool === 'shape') {
      setDraft((d) => (d ? { ...d, w: p.x - (d.x ?? 0), h: p.y - (d.y ?? 0) } : d))
    } else if (tool === 'eraser') {
      eraseAt(p)
    }
  }

  const onPointerUp = () => {
    if (!drawing.current) return
    drawing.current = false
    setDraft((d) => {
      if (!d) return null
      if (d.kind === 'pen' || d.kind === 'highlighter') {
        if ((d.points?.length ?? 0) > 1) onCommit(d)
      } else if (d.kind === 'arrow') {
        const [a, b] = d.points!
        if (Math.hypot(b.x - a.x, b.y - a.y) > 4) onCommit(d)
      } else if (d.kind === 'shape') {
        if (Math.abs(d.w ?? 0) > 4 || Math.abs(d.h ?? 0) > 4) onCommit(normalizeBox(d))
      }
      return null
    })
  }

  // Forward wheel to React Flow so the GM can zoom while a draw tool is active.
  const onWheel = (e: WheelEvent) => {
    if (!active) return
    const rect = e.currentTarget.getBoundingClientRect()
    const { x, y, zoom: z } = getViewport()
    const nz = Math.min(4, Math.max(0.2, z * (1 - e.deltaY * 0.001)))
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    setViewport({ x: px - ((px - x) / z) * nz, y: py - ((py - y) / z) * nz, zoom: nz })
  }

  const commitText = () => {
    if (textAt && textValue.trim()) {
      onCommit({ id: newId('draw'), kind: 'text', color, width, x: textAt.x, y: textAt.y, text: textValue.trim(), fontSize: 22 })
    }
    setTextAt(null)
    setTextValue('')
  }

  const textScreen = textAt ? flowToScreenPosition(textAt) : null

  return (
    <div
      className="draw-layer"
      style={{ pointerEvents: active ? 'auto' : 'none', cursor: active ? 'crosshair' : 'default' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
    >
      <svg className="draw-svg">
        <g transform={`translate(${vx} ${vy}) scale(${zoom})`}>
          {drawings.map((d) => (
            <Render key={d.id} d={d} />
          ))}
          {draft && <Render d={draft} />}
        </g>
      </svg>
      {textScreen && (
        <input
          className="draw-text-input"
          autoFocus
          value={textValue}
          placeholder="Type…"
          style={{ left: textScreen.x, top: textScreen.y, color, fontSize: 22 * zoom }}
          onChange={(e) => setTextValue(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitText()
            if (e.key === 'Escape') {
              setTextAt(null)
              setTextValue('')
            }
          }}
        />
      )}
    </div>
  )
}
