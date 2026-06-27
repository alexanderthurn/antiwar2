# Antiwar 2

Browser remake of Antiwar v1.5 — Vite, TypeScript, Pixi.js.

**Play:** [alexanderthurn.github.io/antiwar2](https://alexanderthurn.github.io/antiwar2/)

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 — multiple campaigns from the main menu, local co-op (mouse + gamepads).

## Level & campaign authoring

**[Level authoring guide](public/web/level-authoring.md)** — English successor to the v1 `levels_selbermachen.txt` SDK. Covers:

- Creating a **new campaign** (`registry.json`, folder, `index.json`, first level pack)
- Adding levels, bombs, airplanes, rounds, and `aiConfig`
- Per-second units and v1 porting (`scripts/convert-v1.mjs`)

Campaign data and art: `public/assets/campaign/` (`hub/`, `aw/`, `aw2/`, …). Round override reference: [`public/assets/campaign/format.md`](public/assets/campaign/format.md).

Developer schema notes: [`docs/03-data-format.md`](docs/03-data-format.md).

## Debug

Add `?debug=true` to the URL to show an on-screen stats overlay (top-left). Updates twice per second.

```
http://localhost:5173/?debug=true
```

Shows FPS, graphics preset, renderer, viewport size, device pixel ratio, canvas resolution, memory (Chrome), and Pixi render stats when available. Works in menus and gameplay; the flag is kept when navigating (e.g. `?debug=true&level=1`).

## Docs

- **[Level authoring](public/web/level-authoring.md)** — modder guide (campaigns, levels, units)
- [docs/PLAN.md](docs/PLAN.md) — implementation status
- [docs/03-data-format.md](docs/03-data-format.md) — JSON schema reference

## Assets

Graphics and audio live in `public/assets/gfx` and `public/assets/sfx`.