# 🎲 Masterboard

A planning instrument for tabletop RPG game masters: campaigns, story arcs, clocks,
secrets, a typed library, world relations, multi-session planning with a scene tree,
a live session desk, a guided review, and printable director sheets.

> The current spec is **[docs/spec-v2.md](./docs/spec-v2.md)** together with
> **[docs/spec-v3.md](./docs/spec-v3.md)** (fixes from the design review);
> **[docs/spec.md](./docs/spec.md)** is the base they build on. The plan is
> **[docs/roadmap.md](./docs/roadmap.md)**. `DESIGN.md` describes the earlier
> GitHub-synced architecture and is kept for history.

## Status

The base spec in `docs/spec.md` is implemented (checked against the code on 27.09.2026, see
`docs/spec-coverage.md`). The app runs on Cloudflare: one Worker serves the SPA and `/api`;
the one-time Cloudflare setup is in [docs/deploy-cloudflare.md](./docs/deploy-cloudflare.md).

## Stack

React + TypeScript + Vite · React Router · React Flow, served by a Cloudflare Worker
(`worker/`) with D1. Everything is behind email sign-in (Cloudflare Access); campaigns live
on the server and are shared between their masters (`src/local/remote.ts`). Campaigns left
in a browser's IndexedDB by older versions are offered for transfer after sign-in.

## Develop

```bash
npm install
npx wrangler d1 migrations apply masterboard --local --env dev   # once, and after new migrations
npm run worker:dev # Worker + local D1 on :8787, signed in as owner@example.com
npm run dev        # http://localhost:5173, proxies /api to the Worker
npm run build      # production build into dist/
npm run typecheck
npm run lint
npm test           # unit + Testing Library UI scenarios
```

`worker:dev` runs the `dev` environment from `wrangler.jsonc`: Cloudflare Access is off and
every request is signed in as `owner@example.com`. It creates an empty `dist/` if there is no
build yet, because the Worker's static assets point there; the app itself is served by Vite.

## Deploy

`npm run build` produces the static application in `dist/`. The production target is
Cloudflare with `/` as the Vite base path. This repository intentionally contains no
GitHub Pages workflow and no committed Cloudflare credentials.
