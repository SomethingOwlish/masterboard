# 🎲 Masterboard

A planning instrument for tabletop RPG game masters — campaigns, characters, NPCs,
relationship webs, in-world chronology, session planner boards, locations, notes,
rules, tasks, and a one-click printable session sheet. All in one place.

> See **[DESIGN.md](./DESIGN.md)** for the full architecture and module-by-module spec.

## Status

The app shell and campaign modules run as a static SPA. Production hosting is moving
to Cloudflare; deployment credentials and project binding are configured separately.

## Stack

React + TypeScript + Vite · React Router · Zustand · (coming) tldraw, React Flow,
Recharts, TipTap. Storage = a private GitHub repo (folders per GM, split files per
module) with IndexedDB offline cache; images via Imgur.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
npm run typecheck
npm run lint
```

## Deploy

`npm run build` produces the static application in `dist/`. The production target is
Cloudflare with `/` as the Vite base path. This repository intentionally contains no
GitHub Pages workflow and no committed Cloudflare credentials.
