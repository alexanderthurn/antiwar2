# Antiwar — Level authoring guide

Create your own campaigns: economy, rounds, enemy planes, and weapons. This guide replaces the classic v1 SDK readme (`levels_selbermachen.txt`) for the **JSON format** used by Antiwar 2.

**Design space:** all positions are in pixels on a **1920×1080** canvas (letterboxed in the browser).

**Units:** speeds are **pixels per second**, rotation is **degrees per second** (360 = one full turn per second), aim/intro/story timers are **milliseconds**, stealth and drop intervals are **seconds**.

---

## Contents

1. [How a campaign is built](#1-how-a-campaign-is-built)
2. [Level config (`config`)](#2-level-config-config)
3. [Rounds (`rounds`)](#3-rounds-rounds)
4. [Bombs & player rockets (`bombs`)](#4-bombs--player-rockets-bombs)
5. [Airplanes (`airplanes`)](#5-airplanes-airplanes)
6. [AI types](#6-ai-types)
7. [Tips & checklist](#7-tips--checklist)

---

## 1. How a campaign is built

### Files

| File | Purpose |
|------|---------|
| `public/campaign/index.json` | Campaign list, map positions, display names |
| `public/campaign/N.json` | One **level pack** — everything for that level |

Each `N.json` replaces the old v1 quartet (`config.txt`, `levels.txt`, `bombs.txt`, `airplanes.txt`) in a **single file**.

### Top-level shape

```json
{
  "schemaVersion": 1,
  "id": 2,
  "meta": {
    "name": "Desert Strike",
    "author": "Your Name",
    "description": "Short blurb for the campaign map",
    "thumbnail": "assets/gfx/thumbs/desert.png",
    "difficulty": "easy"
  },
  "config": { },
  "bombs": { },
  "airplanes": { },
  "rounds": [ ]
}
```

Add an entry to `index.json` so the level appears on the campaign map:

```json
{
  "file": "14.json",
  "name": "Desert Strike",
  "mapX": 640,
  "mapY": 400,
  "pathType": 1
}
```

### Where things live

```
index.json          → campaign order & map
N.json
  ├─ config         → start money, upgrades, default art & audio
  ├─ bombs          → all projectiles (including BOMB_PLAYER)
  ├─ airplanes      → enemy (and helper) unit types
  └─ rounds[]       → stages played in order
```

Round-specific overrides (background, music, intro) are documented in [`public/campaign/format.md`](../campaign/format.md).

---

## 2. Level config (`config`)

Maps from v1 `config.txt`. Shared for the whole level unless a round overrides something.

### Starting resources

```json
"config": {
  "startMoney": 1000,
  "startHumans": 1,
  "startRockets": 3,
  "startHumanHp": 100,
  "startHumanMoney": 300,
  "startRocketPower": 50,
  "startRocketSpeed": 360,
  "startAimTime": 1000,
  "aimPower": 3,
  "maxHumans": 10,
  "maxRockets": 10,
  "humanHpRefresh": 1,
  "moneyFactor": 1,
  "crashingRockets": 2
}
```

| Field | Unit | Description |
|-------|------|-------------|
| `startMoney` | — | Cash at level start |
| `startHumans` | — | Civilians on the ground |
| `startRockets` | — | Max rockets in the air (split across players in multiplayer) |
| `startHumanHp` | — | Civilian hit points |
| `startHumanMoney` | — | Payout per survivor at round end |
| `startRocketPower` | — | Rocket damage (before shop upgrades) |
| `startRocketSpeed` | **px/s** | Rocket velocity (e.g. `360` ≈ old v1 `6`) |
| `startAimTime` | **ms** | Time crosshair must stay on target to lock |
| `aimPower` | — | Guided rocket damage multiplier |
| `maxHumans` | — | Shop cap on civilians |
| `maxRockets` | — | Shop cap on concurrent rockets |
| `humanHpRefresh` | — | `1` = full HP refill each round; `0` = keep damage |
| `moneyFactor` | — | Multi-kill bonus on civilian payouts |
| `crashingRockets` | hits | Rockets needed before a plane tumbles instead of exploding |

### Story limits (optional)

```json
"storyLimits": {
  "maxTime": -1,
  "maxRoundTime": -1,
  "maxRockets": -1,
  "maxRoundRockets": -1,
  "maxHumanDeaths": -1,
  "minMoney": -1
}
```

`-1` disables a limit. Times are **milliseconds**. Per-round overrides use `rounds[].storyLimits` (sticky merge).

### Shop upgrades

```json
"upgrades": {
  "human":       { "price": 100, "priceFactor": 1.5, "statFactor": null },
  "humanHp":     { "price": 100, "priceFactor": 1.5, "statFactor": 1.1 },
  "humanMoney":  { "price": 100, "priceFactor": 1.5, "statFactor": 1.15 },
  "rocket":      { "price": 100, "priceFactor": 1.5, "statFactor": null },
  "rocketSpeed": { "price": 100, "priceFactor": 1.5, "statFactor": 1.5 },
  "rocketPower": { "price": 100, "priceFactor": 1.5, "statFactor": 1.5 },
  "aim":         { "price": 100, "priceFactor": 1.5, "statFactor": 0.5 }
}
```

`statFactor` multiplies the stat each purchase (`0.5` on `aim` = faster lock). `priceFactor` increases price per purchase.

Disable shop buttons:

```json
"buttonsDisabled": {
  "human": false,
  "rocketSpeed": true
}
```

### Assets & audio

```json
"assets": {
  "tower": "assets/gfx/tower.png",
  "cannon": "assets/gfx/cannon.png",
  "crosshair": "assets/gfx/crosshair1.png",
  "human": "assets/gfx/human.png",
  "background": "assets/gfx/backgrounds/mangoo.jpg",
  "ground": "assets/gfx/backgrounds/ground.png"
},
"sounds": {
  "music": "game.ogg",
  "musicVolume": 1,
  "explosion": ["explosion2.ogg", "explosion3.ogg"],
  "shoot": "shoot.ogg",
  "newRound": "gong.ogg",
  "winner": "winner.ogg",
  "win": "win.ogg"
}
```

Paths under `sounds` are relative to `assets/sfx/`. Graphics use full paths under `assets/gfx/`.

---

## 3. Rounds (`rounds`)

Each array entry is one stage (old v1 `[SECTION]` in `levels.txt`). **Order = play order.**

### Example round

```json
{
  "name": "FIRST WAVE",
  "weather": [0, 0, 0, 0, 0],
  "intro": {
    "text": "Shoot down the bombers!",
    "image": "assets/gfx/AIRPLANES/bomber.png",
    "time": 3000,
    "sound": "tutorial/shootall.ogg"
  },
  "maxAirplanes": 0,
  "endmaster": -1,
  "rumble": 2,
  "spawns": [
    { "kind": "airplane", "type": "BOMBER", "x": -200, "y": 141, "angle": 0 },
    { "kind": "airplane", "type": "BOMBER", "x": 2120, "y": 200, "angle": 0 }
  ]
}
```

### Weather

`weather` is `[rain, clouds, snow, wind, darkness]` — intensity `0` = off, `1` = strong. Examples:

| Scenario | `weather` |
|----------|-----------|
| Clear day | `[0, 0, 0, 0, 0]` |
| Rainy dusk | `[0.7, 0, 0, 0, 0.8]` |
| Snowstorm, wind right | `[0, 0, 1, 1.5, 0]` |

`darkness` above ~`0.4` enables night vision. `wind` is negative = left, positive = right.

### Spawns

```json
{ "kind": "airplane", "type": "BOMBER", "x": 100, "y": 141, "angle": 0 }
```

| Field | Description |
|-------|-------------|
| `type` | Name from `airplanes` |
| `x`, `y` | Start position (design pixels). Off-screen spawns: `x < 0` or `x > 1920` |
| `angle` | Reserved; use `0` |

`helper` spawns are supported but unused in shipped content.

### `maxAirplanes`

| Value | Behavior |
|-------|----------|
| `0` | Spawn **all** planes in `spawns` at once |
| `N > 0` | At most **N** alive; when one is destroyed, the next queued spawn appears |

### `endmaster`

Spawn **index** (0-based order in `spawns`) that gets a persistent boss HP bar. `-1` = no boss bar.

### Sticky round overrides

These apply to **this round and all later rounds** until changed again:

- `background`, `ground` — image paths
- `music`, `musicVolume`
- `sounds` — partial SFX patch

See [`format.md`](../campaign/format.md) for examples.

---

## 4. Bombs & player rockets (`bombs`)

Keyed by name. **`BOMB_PLAYER` is required** in every level pack (player rocket template).

### Example bomb

```json
"BOMB_0": {
  "image": "assets/gfx/BOMBS/bomb.png",
  "scale": [0.8, 0.6],
  "hp": 10,
  "damage": 100,
  "speed": 42,
  "rotationSpeed": 300,
  "explosion": {
    "type": 1,
    "power": 100,
    "range": 2,
    "lifetime": 20
  },
  "trail": 0,
  "checkOutOfScreen": false
}
```

### Player rocket

```json
"BOMB_PLAYER": {
  "image": "assets/gfx/BOMBS/player_rocket.png",
  "scale": [0.5, 0.2],
  "hp": 10,
  "damage": 50,
  "speed": 120,
  "rotationSpeed": 1200,
  "explosion": { "type": 1, "power": 0, "range": 1, "lifetime": 20 },
  "trail": 1,
  "checkOutOfScreen": true
}
```

Effective rocket speed/damage in play = `config.startRocketSpeed` / `startRocketPower` × shop upgrades × lock-on bonus. `BOMB_PLAYER.speed` is a baseline for the template; runtime uses session stats.

### Fields

| Field | Unit | Description |
|-------|------|-------------|
| `image` | path | Sprite under `assets/gfx/` |
| `scale` | `[x, y]` | Draw scale |
| `hp` | — | Hits to destroy in air |
| `damage` | — | Direct hit damage |
| `speed` | **px/s** | Fall speed or bullet velocity (typical bombs: `18`–`78`) |
| `rotationSpeed` | **deg/s** | Homing turn rate for player rockets |
| `explosion.type` | — | `0` none, `1` normal, `2` anthrax, `3` nuke, `4` napalm |
| `explosion.power` | — | Blast damage to civilians |
| `explosion.range` | units | Blast radius (× 40 px in engine) |
| `trail` | — | `> 0` draws rocket exhaust |
| `checkOutOfScreen` | — | `true` for player rockets |
| `onDeath` | — | Optional `{ "bomb": "NAME", "count": 3 }` submunitions |
| `feeder` | — | Civilian knockback strength on blast |

---

## 5. Airplanes (`airplanes`)

Define enemy types referenced by `spawns[].type`.

### Example bomber

```json
"BOMBER": {
  "hp": 50,
  "speed": 120,
  "rotationSpeed": 21600,
  "weapons": ["BOMB_0"],
  "ai": "BOMBERSIMPLE",
  "aiConfig": {
    "flightBand": { "minY": 0, "maxY": 422 },
    "dropIntervalSec": 10
  },
  "drawStyle": 0,
  "image": "assets/gfx/AIRPLANES/bomber.png",
  "scale": [0.8, 0.8]
}
```

### Core fields

| Field | Unit | Description |
|-------|------|-------------|
| `hp` | — | Plane health |
| `speed` | **px/s** | Patrol speed (typical bombers: `120`–`240`) |
| `rotationSpeed` | **deg/s** | Turn rate for fighters (`drawStyle: 1`); ignored for flipping bombers |
| `weapons` | names | Bomb types from `bombs` (index 0 = primary) |
| `ai` | — | Behavior name — see [§6](#6-ai-types) |
| `aiConfig` | — | AI tuning — see below |
| `drawStyle` | — | `0` flip left/right, `1` rotate (fighter), `2` heli tilt |
| `image`, `scale` | — | Sprite path and scale |
| `stealthPhaseSec` | **s** | Seconds per stealth / visible phase; omit or `0` = off |
| `scream`, `lastScream` | path | SFX on hit / on death |

### `aiConfig` — named AI parameters

Use **explicit fields** instead of numbered `KI_PARAM_A/B/C`.

#### Patrol planes (most types)

```json
"aiConfig": {
  "flightBand": { "minY": 0, "maxY": 422 },
  "dropIntervalSec": 10
}
```

| Field | Unit | Description |
|-------|------|-------------|
| `flightBand.minY` | px | Bottom of vertical patrol band |
| `flightBand.maxY` | px | Top of patrol band |
| `dropIntervalSec` | **s** | Average time between primary weapon drops |

The plane drifts between random altitudes in the band. Lower `dropIntervalSec` = more aggressive (e.g. `0.083` ≈ machine-gun rate).

#### Parachute kamikaze

```json
"ai": "PARACHUTE",
"aiConfig": {
  "glideTarget": { "startX": 0, "endX": 960 }
}
```

Glides horizontally toward `endX` (or `startX` depending on direction), descends, detonates `weapons[0]` on impact. No `flightBand` or `dropIntervalSec`.

#### Carrier

```json
"ai": "CARRIER",
"aiConfig": {
  "flightBand": { "minY": 70, "maxY": 200 }
}
```

Spawns a child plane from `weapons[0]` every ~2.5 s (engine default). `dropIntervalSec` is not used.

### Fighter with machine gun

```json
"FIGHTER_MG": {
  "hp": 200,
  "speed": 300,
  "rotationSpeed": 300,
  "weapons": ["BOMB_MG"],
  "ai": "FIGHTERMG",
  "aiConfig": {
    "flightBand": { "minY": 0, "maxY": 422 },
    "dropIntervalSec": 0.083
  },
  "drawStyle": 1,
  "image": "assets/gfx/AIRPLANES/fighter_mg.png",
  "scale": [0.32, 0.32]
}
```

`BOMB_MG` should be a fast, low-damage projectile with directional velocity (see any campaign file for a template).

### Stealth bomber

```json
"stealthPhaseSec": 4
```

Alternates **4 s** invisible / **4 s** visible.

---

## 6. AI types

Built into the engine — you **pick a name**, not write scripts.

| AI | Weapons | `aiConfig` | Behavior |
|----|---------|------------|----------|
| `BOMBERSIMPLE` | 1 | band + drop | Left ↔ right; retargets altitude on turn |
| `BOMBERRANDOM` | 1 | band + drop | Like simple; up to 3 altitude changes per crossing |
| `BOMBERHARD` | 1 | band + drop | Carpet: 5 bombs in a row when firing |
| `FIGHTERSIMPLE` | 1 | band + drop | Erratic band movement |
| `FIGHTERMG` | 1 | band + drop | Waypoint attack runs; fires along nose |
| `HELISIMPLE` | 1 | band + drop | Horizontal patrol + bobbing |
| `HELIAPACHE` | 1 | band only | High approach → dive → burst at bottom → climb out |
| `FIGHTERLIZZARD` | 2 | band + drop | Dive + MG; 3 missiles at turn (`weapons[1]`) |
| `CARRIER` | 1 | band only | Spawns child type from `weapons[0]` |
| `PARACHUTE` | 1* | glideTarget | Glide to X, ground detonation |
| `BARON`, `VOGEL`, `RICE`, `BUSH` | 1–2 | band + drop | Boss patterns + scripted secondary attacks |

\*Parachute uses its weapon as the ground explosion, not air drops.

Aliases accepted: `KIHELISIMPLE` → `HELISIMPLE`, `KICARRIER` → `CARRIER`, etc.

### Drop timing

Each frame the engine rolls: `random() < dt / dropIntervalSec`. So `10` ≈ one bomb every 10 seconds on average, not on a fixed clock.

### `drawStyle` cheat sheet

| Value | Look |
|-------|------|
| `0` | Bomber — sprite flips horizontally |
| `1` | Fighter — rotates toward movement |
| `2` | Helicopter — slight nose tilt |

---

## 7. Tips & checklist

### Minimal new level

1. Copy an existing `public/campaign/N.json` close to your idea.
2. Change `id`, `meta`, and register in `index.json`.
3. Tweak `rounds[].spawns` and `maxAirplanes`.
4. Adjust `airplanes.*.aiConfig.dropIntervalSec` for pressure.
5. Test in dev: `npm run dev` → campaign map → your level.

### Coordinates

- Ground line is near **y ≈ 880** (see `DESIGN.groundY` in code).
- Spawn bombers at **y = 100–400** for sky patrol.
- **x = -200** enters from the left; **x = 2120** from the right.

### Porting old v1 text campaigns

| v1 | JSON |
|----|------|
| `SPEED: 2` | `"speed": 120` |
| `ROTATION_SPEED: 20` | `"rotationSpeed": 1200` |
| `KI_PARAM_A/B` (Y) | `flightBand.minY` / `maxY` |
| `KI_PARAM_C: 600` | `dropIntervalSec: 10` |
| `INTRO_TIME: 300` (frames) | `intro.time: 5000` (ms) — shipped levels already use ms |

Use `node scripts/convert-v1.mjs` for bulk conversion. Details: `docs/04-v1-porting.md` (developer docs).

### Validate before shipping

- [ ] `BOMB_PLAYER` exists
- [ ] Every `spawns[].type` exists in `airplanes`
- [ ] Every `weapons[]` entry exists in `bombs`
- [ ] `aiConfig` matches AI (parachute → `glideTarget`, not `flightBand`)
- [ ] `maxAirplanes` matches intended wave pressure
- [ ] Story limits use **ms**, speeds use **px/s**

---

## Quick reference — units

| Quantity | Unit |
|----------|------|
| Position `x`, `y` | pixels (1920×1080) |
| `speed`, `startRocketSpeed` | px/s |
| `rotationSpeed` | deg/s (360 = 1 rotation/s) |
| `dropIntervalSec`, `stealthPhaseSec` | seconds |
| `intro.time`, `startAimTime`, `storyLimits.*Time` | milliseconds |
| `weather` values | 0–1+ intensity (dimensionless) |

---

*Have fun — and good luck defending the civilians.*
