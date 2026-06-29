// Session planner board (M7 / B5): an infinite tldraw canvas per session document.
// The palette drops entities (Players / NPCs / Locations / Misc / Events) as linked
// tokens — geo shapes carrying the entity's id+kind in shape.meta, so they stay live
// references. Draw tldraw frames as Scenes; tokens dropped into a frame become that
// scene's members. The whole canvas persists as a snapshot in SessionDoc.canvas, and
// scenes are derived from the frames on every save so Print (B9) can read them.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Tldraw,
  createShapeId,
  getSnapshot,
  loadSnapshot,
  toRichText,
  type Editor,
  type TLComponents,
  type TLDefaultColorStyle,
  type TLShape,
} from 'tldraw'
import 'tldraw/tldraw.css'
import type { Scene } from '../model/types'
import { useChronology } from '../store/chronology'
import { KIND_GLYPH, useEntityPool } from '../store/entities'
import { sessionTitle, useSessions } from '../store/sessions'

// tldraw palette colours + glyphs per token kind ('event' is planner-only).
const TOKEN_COLOR: Record<string, TLDefaultColorStyle> = {
  pc: 'blue',
  npc: 'violet',
  location: 'green',
  misc: 'orange',
  event: 'grey',
}
const GLYPH: Record<string, string> = { ...KIND_GLYPH, event: '📜' }

// tldraw disables its editor on production deploys (https + non-localhost) when
// no license key is present. Supply one via VITE_TLDRAW_LICENSE_KEY, falling back
// to the trial key below. NOTE: this trial EXPIRES 2026-10-07 — after that the
// board will blank again unless a new key is set or tldraw is replaced with a
// free-forever canvas. The key is domain-scoped and public, safe to ship.
const TLDRAW_LICENSE_KEY =
  import.meta.env.VITE_TLDRAW_LICENSE_KEY ||
  'tldraw-2026-10-07/WyJJczFhSm1IOSIsWyIqIl0sMTYsIjIwMjYtMTAtMDciXQ.2znVWM2jiGkJA9jIkNDou3LUGZdRtzmMVt4DFiCyoQGAoPk5tIs5jWEIKVrExsDb/Cnw/k4RjIsgtpjaPnWtMg'

interface PaletteItem {
  id: string
  name: string
  kind: string
}

// Persist only the document portion of a tldraw snapshot — never the session
// (camera, selection, instance state). Session state is tied to one editor
// instance and travels badly across reopen/duplicate, and can crash the renderer.
// Accepts old full `{document, session}` snapshots too, returning their document.
function documentOf(canvas: unknown): unknown {
  if (canvas && typeof canvas === 'object' && 'document' in (canvas as Record<string, unknown>)) {
    return (canvas as { document: unknown }).document
  }
  return canvas
}

/** Read the frames on the canvas as Scenes, with their contained tokens as members. */
function deriveScenes(editor: Editor): Scene[] {
  const shapes = editor.getCurrentPageShapes()
  const frames = shapes.filter((s) => s.type === 'frame')
  const memberOf = (frameId: string) =>
    shapes
      .filter((s) => s.parentId === frameId && typeof s.meta?.entityId === 'string')
      .map((s) => ({ toId: s.meta.entityId as string, kind: (s.meta.kind as string) || undefined }))
  return frames.map((f: TLShape) => ({
    id: f.id,
    name: (f.props as { name?: string }).name || 'Scene',
    x: f.x,
    y: f.y,
    members: memberOf(f.id),
  }))
}

export function SessionPlanner() {
  const { campaignId, sessionId } = useParams()
  const navigate = useNavigate()

  const current = useSessions((s) => s.current)
  const open = useSessions((s) => s.open)
  const updateMeta = useSessions((s) => s.updateMeta)
  const saveCurrent = useSessions((s) => s.saveCurrent)
  const remove = useSessions((s) => s.remove)

  const pool = useEntityPool(campaignId)
  const events = useChronology((s) => s.events)
  const loadChrono = useChronology((s) => s.load)

  const editorRef = useRef<Editor | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unlistenRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (campaignId && sessionId) void open(campaignId, sessionId)
  }, [campaignId, sessionId, open])

  useEffect(() => {
    if (campaignId) void loadChrono(campaignId)
  }, [campaignId, loadChrono])

  // Snapshot + derive the current canvas, swallowing any error so a transient
  // tldraw/store state can never bubble into React and tear the editor down.
  const persist = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    try {
      void saveCurrent({ canvas: getSnapshot(editor.store).document, scenes: deriveScenes(editor) })
    } catch (e) {
      console.warn('[masterboard] session save skipped:', e)
    }
  }, [saveCurrent])

  // Debounced persist of the canvas snapshot + derived scenes.
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(persist, 700)
  }, [persist])

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor
      const doc = documentOf(useSessions.getState().current?.canvas)
      if (doc) {
        try {
          loadSnapshot(editor.store, doc as Parameters<typeof loadSnapshot>[1])
        } catch (e) {
          console.warn('[masterboard] failed to load session canvas:', e)
        }
      }
      // Persist only document (shape) changes the user makes — not camera moves.
      // Keep the unsubscribe so we can detach on unmount (no leaked listeners).
      unlistenRef.current = editor.store.listen(scheduleSave, { source: 'user', scope: 'document' })
    },
    [scheduleSave],
  )

  // Detach the store listener and flush one final save when leaving the planner.
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      unlistenRef.current?.()
      unlistenRef.current = null
      persist()
      editorRef.current = null
    },
    [persist],
  )

  // Recovery: if tldraw can't render a saved board, drop the snapshot and remount
  // a blank canvas (bumping recoverKey) instead of leaving a dead black void.
  const [recoverKey, setRecoverKey] = useState(0)
  const resetBoard = useCallback(() => {
    void saveCurrent({ canvas: null, scenes: [] })
    setRecoverKey((k) => k + 1)
  }, [saveCurrent])

  const components = useMemo<TLComponents>(
    () => ({
      ErrorFallback: () => (
        <div className="planner-canvas-fallback">
          <p><strong>This board couldn't be opened.</strong></p>
          <p className="muted">
            Its saved drawing looks corrupted. Resetting clears the drawing only — your linked
            characters, NPCs, locations and events are unaffected.
          </p>
          <button className="primary" onClick={resetBoard}>Reset board to blank</button>
        </div>
      ),
    }),
    [resetBoard],
  )

  function dropToken(item: PaletteItem) {
    const editor = editorRef.current
    if (!editor) return
    const center = editor.getViewportPageBounds().center
    editor.createShape({
      id: createShapeId(),
      type: 'geo',
      x: center.x - 70,
      y: center.y - 24,
      props: {
        geo: 'rectangle',
        w: 140,
        h: 48,
        richText: toRichText(`${GLYPH[item.kind] ?? ''} ${item.name}`.trim()),
        color: TOKEN_COLOR[item.kind] ?? 'black',
        fill: 'semi',
        size: 's',
        align: 'middle',
        verticalAlign: 'middle',
      },
      meta: { entityId: item.id, kind: item.kind },
    })
  }

  function addScene() {
    const editor = editorRef.current
    if (!editor) return
    const center = editor.getViewportPageBounds().center
    editor.createShape({
      id: createShapeId(),
      type: 'frame',
      x: center.x - 160,
      y: center.y - 120,
      props: { w: 320, h: 240, name: 'New scene' },
    })
  }

  const groups: { label: string; items: PaletteItem[] }[] = [
    { label: 'Players', items: pool.filter((e) => e.kind === 'pc') },
    { label: 'NPCs', items: pool.filter((e) => e.kind === 'npc') },
    { label: 'Locations', items: pool.filter((e) => e.kind === 'location') },
    { label: 'Misc', items: pool.filter((e) => e.kind === 'misc') },
    { label: 'Events', items: events.map((e) => ({ id: e.id, name: e.title || e.date || '(event)', kind: 'event' })) },
  ]

  if (!current) {
    return (
      <div className="content">
        <p className="muted">Loading session…</p>
      </div>
    )
  }

  // Pin tldraw's theme to the app's instead of letting it follow the OS — only
  // "parchment" is a light theme; dark / contrast / neon are dark. Otherwise the
  // board would flip dark on a machine in OS dark mode, clashing with the app.
  const appTheme = document.documentElement.getAttribute('data-theme')
  const colorScheme = appTheme && appTheme !== 'parchment' ? 'dark' : 'light'

  return (
    <div className="planner-page">
      <div className="planner-head no-print">
        <button className="ghost" onClick={() => navigate(`/campaign/${campaignId}/sessions`)} title="Back to sessions">
          ← Sessions
        </button>
        <input
          className="planner-name"
          value={current.name}
          placeholder="Session name"
          onChange={(e) => void updateMeta(current.id, { name: e.target.value })}
        />
        <input
          type="date"
          value={current.realDate}
          onChange={(e) => void updateMeta(current.id, { realDate: e.target.value })}
        />
        <span className="muted">#{current.seq}</span>
        <span style={{ flex: 1 }} />
        <button onClick={addScene}>+ Scene</button>
        <button
          className="ghost"
          onClick={() => {
            if (window.confirm(`Delete session ${sessionTitle(current)}?`)) {
              void remove(current.id)
              navigate(`/campaign/${campaignId}/sessions`)
            }
          }}
        >
          Delete
        </button>
      </div>

      <div className="planner-body">
        <aside className="planner-palette no-print">
          <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.82rem' }}>
            Click to drop a linked token onto the board.
          </p>
          {groups.map((g) => (
            <div key={g.label} className="palette-group">
              <h3 className="palette-title">{g.label}</h3>
              {g.items.length === 0 ? (
                <p className="muted palette-empty">None yet.</p>
              ) : (
                g.items.map((item) => (
                  <button key={item.id} className="palette-item" onClick={() => dropToken(item)}>
                    <span aria-hidden>{GLYPH[item.kind]}</span> {item.name}
                  </button>
                ))
              )}
            </div>
          ))}
        </aside>

        <div className="planner-canvas">
          <Tldraw
            key={`${current.id}:${recoverKey}`}
            licenseKey={TLDRAW_LICENSE_KEY}
            colorScheme={colorScheme}
            components={components}
            onMount={handleMount}
          />
        </div>
      </div>
    </div>
  )
}
