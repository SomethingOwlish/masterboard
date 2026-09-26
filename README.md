# 🎲 Masterboard

A planning instrument for tabletop RPG game masters: campaigns, story arcs, clocks,
secrets, a typed library, world relations, multi-session planning with a scene tree,
a live session desk, a guided review, and printable director sheets.

> The current spec is **[docs/spec.md](./docs/spec.md)**, the plan is
> **[docs/roadmap.md](./docs/roadmap.md)**. `DESIGN.md` describes the earlier
> GitHub-synced architecture and is kept for history.

## Status

The app shell and campaign modules run as a static SPA. Production hosting is moving
to Cloudflare; deployment credentials and project binding are configured separately.

## Stack

React + TypeScript + Vite · React Router · React Flow, served by a Cloudflare Worker
(`worker/`) with D1. Everything is behind email sign-in (Cloudflare Access); campaigns live
on the server and are shared between their masters (`src/local/remote.ts`). Campaigns left
in a browser's IndexedDB by older versions are offered for transfer after sign-in.

## Develop

```bash
npm install
npm run worker:dev # Worker + local D1 on :8787, signed in as owner@example.com
npm run dev        # http://localhost:5173, proxies /api to the Worker
npm run build      # production build into dist/
npm run typecheck
npm run lint
npm test           # unit + Testing Library UI scenarios
```

## Deploy

`npm run build` produces the static application in `dist/`. The production target is
Cloudflare with `/` as the Vite base path. This repository intentionally contains no
GitHub Pages workflow and no committed Cloudflare credentials.
