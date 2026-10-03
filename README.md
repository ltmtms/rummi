# Rummi

A modern, browser-based take on the classic Rummikub-style tile game. Build runs and groups, rework the table, and race 1–3 computer opponents to empty your rack.

Everything runs client-side — no server, no accounts — so the app is exported as a static site and deployed to **GitHub Pages**. Games autosave to `localStorage`, so a refresh picks up where you left off.

## Features

- Full 106-tile set (1–13 in four colors ×2, plus two jokers) and standard rules: 30-point initial meld, free table rearrangement after opening, joker penalty of 30.
- Tap-to-select or drag-and-drop tiles; sets auto-arrange and invalid sets are flagged in red.
- Undo to the start of your turn, rack sorting by runs or groups, and a hint button.
- Three bot difficulties (Relaxed, Classic, Sharp). Stronger bots borrow tiles from the table and split runs.
- Running scoreboard across rounds, activity log, and a responsive layout for desktop and mobile.

## Run locally

```bash
npm install
npm run dev        # http://localhost:4317
```

Other scripts: `npm run build` (static export to `out/`) and `npm run lint`.

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and publishes the site on every push to `main`.

1. Push this repo to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions** (the workflow also tries to enable this automatically).
3. Push to `main` (or run the workflow manually from the **Actions** tab). The game will be live at `https://<user>.github.io/<repo>/`.

The workflow passes the Pages base path (e.g. `/<repo>`) to the build via `PAGES_BASE_PATH`, so asset URLs work under a project subpath. Leave it unset for local builds or a custom domain.

## Project layout

- `src/lib/rummi/` — game engine: tiles, set validation, turn rules, and bot AI (framework-free, pure functions).
- `src/components/game/` — UI: start screen, board, rack, opponents, dialogs.
- `src/components/ui/` — shadcn/ui primitives.
