// Session-planner board model (M7 / B11). The planner was rebuilt off tldraw onto
// React Flow + a custom annotation layer, so the canvas now persists as our own
// JSON (this BoardState) instead of a tldraw snapshot. Two layers live here:
//   • React Flow nodes/edges — Scenes (group nodes) + entity tokens (their
//     children) + scene-to-scene flow arrows (edges).
//   • Drawings — the freehand annotation layer (pen, highlighter, shapes, text,
//     arrows, stickers) that floats in canvas space, independent of scenes.
// Scenes for Print (B9) are derived from the nodes, so the Print contract is
// unchanged: a Scene is a scene node plus the entity tokens parented to it.

import type { Scene } from '../model/types'

export type TokenKind = 'pc' | 'npc' | 'location' | 'misc' | 'event'

/** Lucide icon per token kind ('event' is planner-only). Mirrors KIND_ICON. */
export const TOKEN_ICON: Record<TokenKind, string> = {
  pc: 'shield',
  npc: 'drama',
  location: 'map-pin',
  misc: 'dices',
  event: 'history',
}

export const SCENE_DEFAULT = { w: 320, h: 240 }

// ---- Serialized board (what we store in SessionDoc.canvas) -----------------

export interface SerNode {
  id: string
  type: 'scene' | 'token'
  x: number
  y: number
  parentId?: string
  // scene
  name?: string
  w?: number
  h?: number
  // token
  entityId?: string
  entityKind?: TokenKind
}

export interface SerEdge {
  id: string
  source: string
  target: string
  label?: string
  directed?: boolean
}

// ---- Annotation layer ------------------------------------------------------

export type DrawTool =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'shape'
  | 'text'
  | 'arrow'
  | 'sticker'
  | 'eraser'

export type ShapeKind = 'rectangle' | 'ellipse' | 'line'

export interface Point {
  x: number
  y: number
}

export interface Drawing {
  id: string
  kind: 'pen' | 'highlighter' | 'shape' | 'text' | 'arrow' | 'sticker'
  color: string
  width: number
  /** pen / highlighter (many points); arrow (exactly two: start, end). */
  points?: Point[]
  /** shape only. */
  shape?: ShapeKind
  /** shape bbox, or text / sticker anchor. */
  x?: number
  y?: number
  w?: number
  h?: number
  /** text content, or sticker emoji. */
  text?: string
  fontSize?: number
}

export interface BoardState {
  v: 2
  nodes: SerNode[]
  edges: SerEdge[]
  drawings: Drawing[]
}

export function emptyBoard(): BoardState {
  return { v: 2, nodes: [], edges: [], drawings: [] }
}

/**
 * Read a persisted canvas blob as a BoardState. Old tldraw snapshots (or null)
 * have no `v: 2` marker and resolve to an empty board — the B11 decision was to
 * drop legacy canvas drawings while keeping the structured scenes/links.
 */
export function loadBoard(canvas: unknown): BoardState {
  if (canvas && typeof canvas === 'object' && (canvas as Partial<BoardState>).v === 2) {
    const b = canvas as BoardState
    return {
      v: 2,
      nodes: Array.isArray(b.nodes) ? b.nodes : [],
      edges: Array.isArray(b.edges) ? b.edges : [],
      drawings: Array.isArray(b.drawings) ? b.drawings : [],
    }
  }
  return emptyBoard()
}

/**
 * Derive the Print-facing Scenes from the board: every scene node, with the
 * entity tokens parented to it as members. Membership is the React Flow parent
 * relationship (spatial containment is resolved into `parentId` on drag), so this
 * stays in lock-step with what the user sees.
 */
export function deriveScenes(nodes: SerNode[]): Scene[] {
  return nodes
    .filter((n) => n.type === 'scene')
    .map((s) => ({
      id: s.id,
      name: s.name || 'Scene',
      x: s.x,
      y: s.y,
      members: nodes
        .filter((n) => n.type === 'token' && n.parentId === s.id && n.entityId)
        .map((n) => ({ toId: n.entityId as string, kind: n.entityKind })),
    }))
}
