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

### 2. Improve connected-site import
The site importer (`ImportDialog` + `httpImport` + `importEntities`, B8) only handles
a flat JSON array mapped to one entity kind, and we only really use two GitHub-Pages
sites. Extend it toward what the template importer already does: accept a hosted
combined template (`masterboard-import/v1`) so a GHP site can carry a whole campaign,
and/or let one fetch map several arrays to several kinds in one pass. Needs concrete
detail on what's failing with the two live sites before starting.

## Done

### ~~2a. Document import parser → template import~~ ✓
First attempt heuristically parsed Markdown/HTML/SVG into routed blocks, but real
generated docs (e.g. a `<details>`/`<summary>` session doc) parsed badly — it can't
infer structure it wasn't given. Replaced with a deterministic **template import**:
`src/lib/importTemplate.ts` defines a combined `masterboard-import/v1` JSON covering
every module, with a downloadable blank template and an LLM-fill prompt to convert a
prose/HTML doc into it. `TemplateImportDialog` (button "Import template" in the
Connected sites panel) validates the filled file, shows a per-section summary, and
`commitTemplate` (`src/store/importing.ts`) files each section — resolving/creating
timeline columns and linking relations by name — deduping by name per kind so
re-import is safe. The heuristic parser (`docParse.ts`, `DocumentImportDialog`,
`guessRoute`/`commitRoutedEntities`) was removed.
