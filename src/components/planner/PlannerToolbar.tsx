// The session board's floating tool palette (B11). One active tool at a time:
// Select hands the canvas to React Flow (move/connect/pan); every other tool hands
// pointers to the annotation layer. Contextual controls (colour, width, shape kind,
// sticker) appear for the relevant tools.

import { useState } from 'react'
import { Icon } from '../../ds'
import type { DrawTool, ShapeKind } from '../../lib/board'

const TOOLS: { tool: DrawTool; icon: string; label: string }[] = [
  { tool: 'select', icon: 'mouse-pointer-2', label: 'Select / move' },
  { tool: 'pen', icon: 'pencil', label: 'Pen' },
  { tool: 'highlighter', icon: 'highlighter', label: 'Highlighter' },
  { tool: 'shape', icon: 'square', label: 'Shape' },
  { tool: 'arrow', icon: 'arrow-up-right', label: 'Arrow' },
  { tool: 'text', icon: 'type', label: 'Text' },
  { tool: 'sticker', icon: 'smile', label: 'Sticker' },
  { tool: 'eraser', icon: 'eraser', label: 'Eraser' },
]

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#111827', '#ffffff']
const WIDTHS: { w: number; label: string }[] = [
  { w: 2, label: 'S' },
  { w: 4, label: 'M' },
  { w: 8, label: 'L' },
]
const SHAPES: { kind: ShapeKind; icon: string }[] = [
  { kind: 'rectangle', icon: 'square' },
  { kind: 'ellipse', icon: 'circle' },
  { kind: 'line', icon: 'minus' },
]
const STICKERS = ['☠️', '⭐', '⚔️', '🔥', '💀', '❗', '❓', '🎯', '🗝️', '💰', '⚠️', '❤️', '🛡️', '🐉', '👁️', '🏰']

interface Props {
  tool: DrawTool
  setTool: (t: DrawTool) => void
  color: string
  setColor: (c: string) => void
  width: number
  setWidth: (w: number) => void
  shapeKind: ShapeKind
  setShapeKind: (s: ShapeKind) => void
  sticker: string
  setSticker: (s: string) => void
  canUndo: boolean
  onUndo: () => void
  onClearInk: () => void
}

export function PlannerToolbar(props: Props) {
  const { tool, setTool, color, setColor, width, setWidth, shapeKind, setShapeKind, sticker, setSticker } = props
  const [stickerOpen, setStickerOpen] = useState(false)

  const inkTool = tool !== 'select' && tool !== 'eraser'

  return (
    <div className="planner-toolbar no-print">
      <div className="toolbar-row">
        {TOOLS.map((t) => (
          <button
            key={t.tool}
            className={`tool-btn${tool === t.tool ? ' active' : ''}`}
            title={t.label}
            aria-label={t.label}
            aria-pressed={tool === t.tool}
            onClick={() => {
              setTool(t.tool)
              if (t.tool === 'sticker') setStickerOpen(true)
            }}
          >
            <Icon name={t.icon} size={17} />
          </button>
        ))}
        <span className="toolbar-sep" />
        <button className="tool-btn" title="Undo last drawing" aria-label="Undo" disabled={!props.canUndo} onClick={props.onUndo}>
          <Icon name="undo-2" size={17} />
        </button>
        <button className="tool-btn" title="Clear all ink" aria-label="Clear ink" onClick={props.onClearInk}>
          <Icon name="trash-2" size={17} />
        </button>
      </div>

      {inkTool && (
        <div className="toolbar-row toolbar-options">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch${color === c ? ' active' : ''}`}
              style={{ background: c }}
              title={c}
              aria-label={`Colour ${c}`}
              onClick={() => setColor(c)}
            />
          ))}
          <span className="toolbar-sep" />
          {WIDTHS.map((w) => (
            <button key={w.w} className={`width-btn${width === w.w ? ' active' : ''}`} title={`Width ${w.label}`} onClick={() => setWidth(w.w)}>
              {w.label}
            </button>
          ))}
          {tool === 'shape' && (
            <>
              <span className="toolbar-sep" />
              {SHAPES.map((s) => (
                <button
                  key={s.kind}
                  className={`tool-btn${shapeKind === s.kind ? ' active' : ''}`}
                  title={s.kind}
                  aria-label={s.kind}
                  onClick={() => setShapeKind(s.kind)}
                >
                  <Icon name={s.icon} size={15} />
                </button>
              ))}
            </>
          )}
          {tool === 'sticker' && (
            <>
              <span className="toolbar-sep" />
              <button className="sticker-current" title="Pick sticker" onClick={() => setStickerOpen((o) => !o)}>
                {sticker}
              </button>
            </>
          )}
        </div>
      )}

      {tool === 'sticker' && stickerOpen && (
        <div className="sticker-picker">
          {STICKERS.map((s) => (
            <button
              key={s}
              className={`sticker-opt${sticker === s ? ' active' : ''}`}
              onClick={() => {
                setSticker(s)
                setStickerOpen(false)
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
