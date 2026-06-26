# Antiwar 2 — Plan

**Start here** for current status and what’s left. Reference docs for JSON, mechanics, and AI live in the same folder.

## Run

```bash
npm install && npm run dev
```

http://localhost:5173 — campaign, co-op, 12 levels. Dev URL: `?level=&round=&upgrades=&money=`.

---

## Done

Core game is playable end-to-end.

| Area | Status |
|------|--------|
| **Engine** | Vite + TS + Pixi v8, 1920×1080 letterbox, design-space input |
| **Content** | `1.json`–`12.json` + `scripts/convert-v1.mjs` |
| **Campaign** | Main menu → map hub → levels; linear unlock per session |
| **Combat** | Dual turrets, lock-on, civilians, round win/loss, rumble |
| **Shop** | 7 upgrades between rounds; Continue on any input |
| **Co-op** | Up to 5 (mouse P1 + 4 gamepads + touch fire); fair rocket caps |
| **Input** | `InputSystem` + `UiMenuController` — mouse, touch, gamepad on all menus |
| **AI** | Standard + boss patterns (`BOMBERSIMPLE` … `BUSH`) |
| **FX** | Animated explosions (4×3), weather, night vision, kill streaks, floating HP bars |
| **Extras** | Stealth, crash-fall rockets, submunitions, boss HP bar, dev cheat `-` |
| **Audio** | SFX + looping music (`game.ogg`); on/off via settings |
| **Settings** | `SettingsStore` + overlay (main menu & pause): sound, music, particles |
| **Polish** | Round-end stats banner, join-panel D-pad row focus, particle quality tiers |

Theme matches **v1 Antiwar**. No save game — fresh run each session.

---

## Remaining

See **[v1-parity-plan.md](./v1-parity-plan.md)** for the active backlog (Fish story limits, Schnappi bonus level, hardcore/scores, BLOODY/feeder, autobuy/autofire).

Recently completed: per-round visuals/audio, buy macros (keys 1–9), `public/campaign/format.md`.

## Explicitly out of scope (v1 release)

Starcraft campaign (copyright), online highscore PHP backend, per-level buyscript names, `START_LEVEL` skip, `NONE` backgrounds.

---

## Reference docs

| Doc | Use when |
|-----|----------|
| [03-data-format.md](./03-data-format.md) | Authoring or validating level JSON |
| [04-v1-porting.md](./04-v1-porting.md) | Converting `old/data/` packs |
| [06-multiplayer.md](./06-multiplayer.md) | Player slots, caps, join/leave rules |
| [07-game-mechanics.md](./07-game-mechanics.md) | Rockets, shop, economy, rounds |
| [08-ai-types.md](./08-ai-types.md) | Enemy AI names and parameters |
| [09-architecture.md](./09-architecture.md) | Module layout (some names drifted — check `src/`) |
| [10-decisions.md](./10-decisions.md) | Locked design Q&A |

## v1 reference in repo

| Need | Path |
|------|------|
| Modding SDK | `old/levels_selbermachen.txt` |
| Player manual | `old/readme.txt` |
| Campaign order | `old/data/campaign.txt` |
| Assets | `old/gfx/`, `old/sfx/` → `public/assets/` |
