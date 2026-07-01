# Backlog

Deferred work, roughly by priority. Pull an item into a batch when it's ready.

## High

### 1. Fix save/sync errors
Saving is flaky and the failures cascade — when a write errors, roughly everything
downstream breaks. Root-cause the storage/sync path (`src/storage/repository.ts` +
`src/storage/data.ts` + the GitHub adapter): surface a clear error state, retry or
queue failed writes instead of dropping them, and make sure one failed module write
can't corrupt or block the others. This is the most disruptive current bug.

## Done

### ~~2. SVG / HTML / Markdown import parser~~ ✓
Shipped: `src/lib/docParse.ts` reduces Markdown/HTML/SVG documents to candidate
blocks (heading + body + optional image; SVG splits by font-size tiers).
`DocumentImportDialog` — opened via "Parse document" in the Connected sites panel —
lets the GM route each block to Characters / NPCs / Locations / Misc / Timeline
(auto-suggested via `guessRoute`) and confirm before commit
(`commitRoutedEntities` in `src/store/importing.ts`). Dedups by name per kind.
Scenes were intentionally left out — they need a session/board context.
