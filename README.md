# 🎲 Masterboard

A planning instrument for tabletop RPG game masters: campaigns, story arcs, clocks,
secrets, a typed library, world relations, multi-session planning with scene boards,
a live session desk, a guided review, and printable director sheets.

> The current spec is **[docs/spec.md](./docs/spec.md)**, the plan is
> **[docs/roadmap.md](./docs/roadmap.md)**. `DESIGN.md` describes the earlier
> GitHub-synced architecture and is kept for history.

## Status

The app shell and campaign modules run as a static SPA. Production hosting is moving
to Cloudflare; deployment credentials and project binding are configured separately.

## Stack

React + TypeScript + Vite · React Router · React Flow. Campaign data lives in the
browser's IndexedDB behind the `StorageGateway` contract (`src/adapters/idbStorageGateway.ts`);
campaigns move between browsers through JSON export/import. Integrations come last.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
npm run typecheck
npm run lint
npm test           # unit + Testing Library UI scenarios
```

## Deploy

`npm run build` produces the static application in `dist/`. The production target is
Cloudflare with `/` as the Vite base path. This repository intentionally contains no
GitHub Pages workflow and no committed Cloudflare credentials.
