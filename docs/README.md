# Antiwar 2 — Documentation

Browser remake of **Antiwar v1.5** (Vite + TypeScript + Pixi.js).

**New session?** Start with **[PLAN.md](./PLAN.md)** — what’s done and what’s left.

## Modder guide (shipped with the game)

**[public/web/level-authoring.md](../public/web/level-authoring.md)** — English successor to v1 `levels_selbermachen.txt`. How to create a **new campaign**, add levels, define bombs/planes, and use `aiConfig`. Served at `/web/level-authoring.md` in dev and production builds.

Round sticky overrides: [public/assets/campaign/format.md](../public/assets/campaign/format.md).

## Reference

| Doc | Topic |
|-----|-------|
| [PLAN.md](./PLAN.md) | **Status & backlog** |
| [v1-parity-plan.md](./v1-parity-plan.md) | **v1 gap implementation plan** (Fish limits, Schnappi bonus, HC, BLOODY, autobuy) |
| [03-data-format.md](./03-data-format.md) | JSON level/campaign schema |
| [04-v1-porting.md](./04-v1-porting.md) | `old/data/` → JSON converter |
| [06-multiplayer.md](./06-multiplayer.md) | Co-op players, input, rocket caps |
| [07-game-mechanics.md](./07-game-mechanics.md) | Combat, economy, upgrades |
| [08-ai-types.md](./08-ai-types.md) | Enemy AI behaviors (`aiConfig`) |
| [09-architecture.md](./09-architecture.md) | Code layout (approximate) |
| [10-decisions.md](./10-decisions.md) | Locked design decisions |

## Conventions

- Game coordinates: **1920×1080 design space**, letterboxed to the window.
- Campaign levels: `public/assets/campaign/aw/1.json` … `aw/13.json`, plus `aw2/` for new content.
- When in doubt, match v1 behavior in `old/data/` and `old/readme.txt`.
