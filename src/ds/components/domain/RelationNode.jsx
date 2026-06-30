import React from 'react'
import { Icon } from '../core/Icon'

/**
 * RelationNode — a draggable node for the relation web. PCs and NPCs are
 * distinguished by an accent vs muted left rail and icon. Designed to sit on a
 * patterned board ground with bold connecting lines (see RelationEdge usage in
 * the relations UI kit). `selected` raises it with an accent ring.
 */
export function RelationNode({ name, kind = 'pc', dead = false, selected = false, onClick, style, ...rest }) {
  const accent = kind === 'pc' ? 'var(--accent)' : 'var(--line-strong)'
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px 8px 11px',
        background: 'var(--surface)',
        border: `1px solid ${selected ? accent : 'var(--border)'}`,
        borderLeft: `4px solid ${accent}`,
        borderRadius: 'var(--radius-sm)',
        boxShadow: selected ? `var(--shadow), 0 0 0 3px var(--ring)` : 'var(--shadow-sm)',
        color: 'var(--text)',
        font: 'var(--type-ui)',
        cursor: 'grab',
        opacity: dead ? 0.6 : 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      <span style={{ color: accent, display: 'inline-flex' }}>
        <Icon name={dead ? 'skull' : kind === 'pc' ? 'shield' : 'drama'} size={15} />
      </span>
      {name || '(unnamed)'}
    </button>
  )
}

/**
 * RelationEdge — an SVG line + label between two points on the relation board.
 * Bold, theme-coloured (--line-strong), with an optional arrowhead for directed
 * relations and a chip label at the midpoint. Render inside an SVG overlay.
 */
export function RelationEdge({ from, to, label, directed = false, id = 'e', highlighted = false, labelBg = 'var(--surface)' }) {
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  const color = highlighted ? 'var(--accent)' : 'var(--line-strong)'
  const width = highlighted ? 3 : 2.25
  return (
    <g>
      <defs>
        <marker id={`arrow-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={color} />
        </marker>
      </defs>
      <line
        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
        stroke={color} strokeWidth={width} strokeLinecap="round"
        markerEnd={directed ? `url(#arrow-${id})` : undefined}
        opacity={highlighted ? 1 : 0.85}
      />
      {label && (
        <g transform={`translate(${mx}, ${my})`}>
          <rect x={-(label.length * 3.6 + 9)} y={-11} rx="9" width={label.length * 7.2 + 18} height={22} fill={labelBg} stroke={color} strokeWidth="1" />
          <text x="0" y="4" textAnchor="middle" fontFamily="var(--font-sans)" fontSize="12" fontWeight="600" fill="var(--text)">{label}</text>
        </g>
      )}
    </g>
  )
}
