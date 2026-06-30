# Masterboard — Design

A planning instrument for tabletop RPG game masters. One place to plan sessions,
collect campaign data, draw relationships and chronologies, take notes, pull info
from your other sites, and push tasks to a third. Hosted free on GitHub Pages.

> Status: living design doc. Decisions below are settled unless re-opened.

---

## 1. Principles & constraints

- **Free + static.** Ships as a static SPA on GitHub Pages. No server we pay for.
- **Offline-first.** IndexedDB is the working copy; GitHub is the synced source of truth.
- **Adapters everywhere.** Storage, images, imports, and tasks sit behind interfaces
  so any one can be swapped without touching feature code.
- **Better than Miro for *this* job.** Not a generic whiteboard — a domain tool:
  characters, NPCs, scenes, in-world timelines, session prep, all cross-linked.

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| Build / SPA | React + TypeScript + Vite |
| Routing | react-router-dom (hash-free, SPA fallback via 404.html copy) |
| State | Zustand (per-campaign store) + IndexedDB persistence |
| Infinite canvas | tldraw (session planner, campaign-page planner) |
| Node/relationship graph | React Flow (relation board) |
| Charts | Recharts (dashboards) |
| Timeline | custom column/row grid (in-world chronology) |
| Rich text / markdown | TipTap (notes, rules) |
| Images | Imgur upload adapter |
| Deploy | GitHub Actions → Pages |

---

## 3. Storage architecture

**Isolation = folders.** One private repo shared by the friends group; each GM owns a
top-level folder. (Trade-off: not cryptographically private from other collaborators —
acceptable for a friends group; sensitive fields can be encrypted later.)

**Granularity = split per module.** Each module persists to its own file so saves are
small and git diffs are readable.

**Per-module storage overrides** (set in Campaign Settings): `repo-file` (default),
`imgur` (images), `source-readonly` (live-fetched JSON from one of your two sites),
`separate-md` (standalone markdown).

```
<repo>/
  <gm-handle>/                         # isolation: one folder per GM
    campaigns/
      index.json                       # list of this GM's campaigns (id, name, cover, lastPlayed)
      <campaign-id>/
        campaign.json                  # meta, settings, theme, next-session plan, site links
        characters.json                # player characters
        npcs.json
        locations.json
        misc.json                      # notes / items / custom kinds
        relations.json                 # edges between entities
        timeline.json                  # in-world chronology: columns + events
        log.json                       # session recaps (campaign chronology as notes)
        tasks.json                     # task tracker mirror
        rules.md                       # separate markdown file
        sessions/
          index.json                   # session list + next sequence number
          <session-id>.json            # one independent session document each
```

**Sync model:** load = fetch files (fallback to IndexedDB if offline); edit = write
IndexedDB immediately + debounce a commit to GitHub via the Contents API using the GM's
fine-grained PAT (stored encrypted in IndexedDB, never committed). Last-write-wins;
history comes free from git.

---

## 4. Core data model

```ts
type ID = string
type ImgRef = string            // Imgur URL
type Tag = string
type Link = { toId: ID; kind?: string }   // bidirectional reference between entities

interface Field { id: ID; label: string; value: string; type: 'text'|'number'|'longtext' }

interface Campaign {
  id: ID; name: string; cover?: ImgRef; createdAt: string; lastPlayed?: string
  settings: CampaignSettings
  nextSession: NextSessionPlan       // campaign-page planner (real-world scheduling)
}

interface CampaignSettings {
  theme: ThemeId; accent: string
  sourceSites: { id: ID; label: string; url: string }[]   // the two read-from sites
  taskSite: { repo: string; path: string } | null         // the third (write tasks)
  miscKinds: string[]                                      // GM-defined Misc kinds
  storage: Record<ModuleId, StorageBackend>               // per-module override
}

interface Character { id: ID; name: string; playerName?: string; portrait?: ImgRef
  fields: Field[]; tags: Tag[]; links: Link[] }

interface NPC { id: ID; name: string; portrait?: ImgRef; fields: Field[]
  tags: Tag[]; dead: boolean; notes?: string; links: Link[] }

interface Location { id: ID; name: string; description?: string; image?: ImgRef
  tags: Tag[]; links: Link[] }

interface Misc { id: ID; kind: string; name: string; body?: string
  fields: Field[]; tags: Tag[]; links: Link[] }

interface Relation { id: ID; fromId: ID; toId: ID; label: string; directed: boolean }

// In-world chronology (multi-column timeline)
interface ChronoColumn { id: ID; name: string; fixed: boolean; order: number; minimized: boolean }
interface ChronoEvent { id: ID; columnId: ID; date: string; title: string; body?: string; links: Link[] }

// Campaign-page planner: schedule next real session + recap log of past ones
interface NextSessionPlan { date?: string; attendees: string[]; agenda: string; notes?: string }
interface SessionRecap { id: ID; sessionId?: ID; realDate: string; seq: number; title: string; body: string }

// Independent session documents
interface SessionDoc {
  id: ID; name: string; realDate: string; seq: number   // title = `${name} · ${realDate} · #${seq}`
  canvas: unknown                                        // tldraw snapshot
  scenes: Scene[]
}
interface Scene { id: ID; name: string; x: number; y: number
  members: Link[] }    // npcs / locations / misc / events placed into this scene

interface Task { id: ID; title: string; body?: string; status: 'todo'|'doing'|'done'
  links: Link[]; externalRef?: { url: string; id?: string } }
```

---

## 5. Application shell

- **Hub page** (`/`) — campaign cards (cover, name, last played) + “New campaign”.
  Reads `<gm>/campaigns/index.json`.
- **Burger menu** — collapsible left rail on desktop, slide-over drawer on mobile.
  Lists the open campaign's modules.
- **Themes** — CSS variables; presets **Parchment / Dark / High-contrast / Neon** + accent
  picker. Stored in `campaign.settings`. `data-theme` on `<html>`.
- **Responsive** — desktop multi-panel; mobile single-column with touch pan/zoom on canvases.
- **Command palette** (later batch) — jump to any entity.

---

## 6. Modules — function + frontend

Each module lists **Data** (what it persists), **Functions** (operations), **Frontend** (UI),
**Links** (how it connects to other modules).

### M1 · Campaign creation  *(Hub)*
- **Data:** appends to `campaigns/index.json`, scaffolds the campaign folder.
- **Functions:** `createCampaign`, `listCampaigns`, `openCampaign`, `duplicateCampaign`, `deleteCampaign`.
- **Frontend:** Hub grid + “New campaign” wizard (name, cover→Imgur, theme, source-site URLs,
  task-site config, storage defaults).

### M2 · Campaign page  *(dashboard + planner + recap log)*
- **Data:** `campaign.json` (`nextSession`), `log.json` (`SessionRecap[]`).
- **Functions:** `setNextSession` (date, attendees, agenda), `addRecap`, `editRecap`,
  `fetchFromSource(siteId)` → map JSON into entities, `refreshSource`.
- **Frontend:**
  - **Header** with cover, name, theme, **“Open connected site ↗”** button.
  - **Next-session planner** — pin the real-world date, attendee checklist, agenda board
    (lightweight tldraw or structured card). “What we’ll do next time.”
  - **Session-recap log** — reverse-chronological notes of past sessions (campaign chronology
    as prose), each entry linkable to its session document.
  - **Character block** — compact roster of PCs (reused by the Print compiler).
  - **Connected-site panel** — data pulled from a source site + open button.

### M3 · Characters (PCs)
- **Data:** `characters.json`.
- **Functions:** CRUD, `addField` (GM picks needed fields at creation; defaults
  **Name, Player name, Portrait**), `setTags`, portrait via Imgur.
- **Frontend:** card grid; creation form with default fields + “add field”; detail drawer.

### M4 · NPC board
- **Data:** `npcs.json`.
- **Functions:** CRUD, shared custom-field engine, `toggleDead`, `setTags`.
- **Frontend:** cards like PCs + **Tags (default)** + **Dead checkbox** (dead → greyed/skull);
  filter by tag / alive-dead.

### M5 · Relation board
- **Data:** `relations.json` (+ saved node positions).
- **Functions:** `addRelation`, `editLabel`, `setDirected`, `autoLayout`, `removeRelation`.
- **Frontend:** React Flow with all PCs + NPCs as nodes; drag to connect, label edges
  (“rival”, “owes money”); click node → open entity.

### M6 · Chronology (in-world timeline)
- **Data:** `timeline.json` (`ChronoColumn[]`, `ChronoEvent[]`).
- **Functions:** column CRUD (the **“Campaign” column is `fixed`**, cannot be deleted; others
  scroll / **minimize** / reorder), event CRUD; each event bound to a `columnId` + `date`;
  rows derived per column from its events’ dates.
- **Frontend:** horizontal scroll of columns; fixed column pinned left; event cards drop into a
  chosen column and sit on the row matching their date.

### M7 · Sessions (independent documents)
- **Data:** `sessions/<id>.json` + `sessions/index.json` (holds next `seq`).
- **Functions:** `createSession` (title = `name · realDate · #seq`, seq auto-increments),
  `listSessions`, `openSession`, `duplicateSession`, `deleteSession`.
- **Frontend — Session Planner board (tldraw):**
  - Palette drops **Events, Players, Locations, NPCs, Misc** as **linked tokens** (live refs).
  - Draw **Zones = Scenes**; **place/link** NPCs / locations / items / events into a scene.
  - Arrows for scene-to-scene flow. Move/connect freely.

### M8 · Locations
- **Data:** `locations.json`.
- **Functions:** CRUD, `setImage` (Imgur), `setTags`, link management.
- **Frontend:** list/grid with **name, description, tags, image, links to connected objects**;
  back-links show who/what references the location.

### M9 · Misc
- **Data:** `misc.json`; `settings.miscKinds` (GM-defined kinds).
- **Functions:** CRUD, `registerKind` (note / item / custom), placeable onto Session Planner.
- **Frontend:** flexible cards (body + fields + tags) grouped by kind.

### M10 · Task tracker  *(writes to your third site)*
- **Data:** `tasks.json` (mirror) + `externalRef` per task.
- **Functions:** `createTask` → `taskAdapter` commits a task record to your third site’s repo
  (default), keeps a back-link; `updateStatus`, `syncTasks`.
- **Frontend:** task list with status columns; **“Create task ↗”** button surfaced on any
  entity / note.

### M11 · Rules storage
- **Data:** `rules.md` (separate markdown file).
- **Functions:** load / save markdown, section index, search.
- **Frontend:** TipTap/markdown workspace — headings sidebar, live preview, search.

### M12 · Print / Export compiler
- **Data:** none of its own — reads current Session + Campaign data.
- **Functions:** `compilePrint(sessionId)` gathers:
  1. the **Session Planner page** (rendered board snapshot),
  2. the **character block** from the campaign page,
  3. **all objects used in that session’s scenes** (NPCs, locations, items, events) with their data,
  into a single print-optimized document.
- **Frontend:** a print route with `@media print` styling → browser “Save as PDF”. One sheet,
  everything the GM needs at the table.

---

## 7. Adapters (interfaces)

```ts
interface StorageAdapter { read(path): Promise<Json>; write(path, data): Promise<void>; list(prefix): Promise<string[]> }
interface ImageAdapter   { upload(file): Promise<ImgRef> }                  // Imgur
interface ImportAdapter  { fetch(siteUrl): Promise<Json> }                  // two source sites
interface TaskAdapter    { create(task): Promise<{ url: string; id?: string }> }  // third site
```

---

## 8. Implementation batches

- **B0 — Skeleton & deploy:** Vite scaffold, Actions→Pages, app shell (hub, burger, themes, responsive). *(in progress)*
- **B1 — Storage core:** data model, IndexedDB, GitHub adapter (folders + split files), settings + PAT.
- **B2 — Campaign page:** dashboard, next-session planner, recap log, character block, source panel.
- **B3 — Characters + NPCs:** custom-field engine, cards, tags, dead.
- **B4 — Relation board + in-world chronology.**
- **B5 — Sessions:** independent session docs + Session Planner (tldraw) + scenes.
- **B6 — Locations + Misc.**
- **B7 — Images (Imgur) across modules.** *(done — `ImageAdapter`/`ImgurImageAdapter`, file-picker `ImageField` on portraits/cover/location image)*
- **B8 — Imports (2 sites) + Task tracker (3rd site).** *(done — generic JSON→entity import wizard; Tasks board + `GitHubTaskAdapter` push to a 3rd repo)*
- **B9 — Rules + Print/Export compiler.** *(done — markdown Rules workspace: hand-rolled
  renderer, headings sidebar + section search, autosaving `rules.md`; Print page with a
  session picker → structured scene-card sheet + party block, `@media print` → Save as PDF)*
- **B10 — Polish:** *(done — ⌘/Ctrl-K command palette over modules/sessions/entities with
  `?focus=` deep-links; `g`-prefixed module nav, `n` new-entity, Esc closes overlays; mobile
  passes: full-screen drawers/dialogs, topbar Search button, canvas touch hint)*
- **B11 — Session planner whiteboard rebuild:** *(done — replaced tldraw with React Flow
  (scenes = group nodes, tokens = children, flow = edges) + a custom SVG annotation layer
  (pen, highlighter, shapes, text, free arrows, emoji stickers, eraser) synced to pan/zoom.
  Own JSON canvas (`lib/board`), `deriveScenes` keeps Print's contract; planner chunk 1.7MB→19kB.)*
- **B12 — Finish gaps:** *(in progress — audit M1–M12 for stubs / dead ends / rough edges
  and close the prioritized ones.)*

Single-player throughout; no realtime (by decision).
