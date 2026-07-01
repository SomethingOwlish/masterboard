# Backlog

Deferred work, roughly by priority. Pull an item into a batch when it's ready.

## High

### 1. Fix save/sync errors
Saving is flaky and the failures cascade — when a write errors, roughly everything
downstream breaks. Root-cause the storage/sync path (`src/storage/repository.ts` +
`src/storage/data.ts` + the GitHub adapter): surface a clear error state, retry or
queue failed writes instead of dropping them, and make sure one failed module write
can't corrupt or block the others. This is the most disruptive current bug.

## Medium

### 2. SVG / HTML / Markdown import parser
Build a parser that ingests generated documents (SVG, HTML, Markdown) and loads their
data into the system, routing each piece to the right module (characters, NPCs,
locations, scenes, notes, timeline events…). Extends the existing JSON import wizard
(B8) to unstructured/semi-structured sources — parse, map to entities, let the GM
confirm the routing, then commit.
