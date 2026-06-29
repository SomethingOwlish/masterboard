# 🎲 Masterboard

A planning instrument for tabletop RPG game masters — campaigns, characters, NPCs,
relationship webs, in-world chronology, session planner boards, locations, notes,
rules, tasks, and a one-click printable session sheet. All in one place, hosted free
on GitHub Pages.

> See **[DESIGN.md](./DESIGN.md)** for the full architecture and module-by-module spec.

## Status

**Batch 0 — skeleton & deploy.** Live now: app shell, hub, burger menu, four color
themes, responsive/mobile layout, GitHub Pages deploy pipeline. Module screens are
placeholders that get built out batch by batch (see the roadmap in DESIGN.md §8).

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

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes
to GitHub Pages. Enable Pages → Source: **GitHub Actions** in repo settings once.
The production base path is `/masterboard/` (see `vite.config.ts`).
