# 03 — Data Format (JSON)

Authoritative schema for campaign level files. Each numbered JSON file replaces the v1 quartet: `config.txt`, `levels.txt`, `airplanes.txt`, `bombs.txt`.

All coordinates are in **design space** (1920×1080), letterboxed to the browser window.

---

## File locations

```
public/assets/campaign/
  registry.json           # menu entries: id + menuTitle
  hub/
    index.json            # top-level campaign picker
  aw/
    index.json            # campaign map + level list
    1.json … 13.json      # level packs
  aw2/
    index.json
    1.json …
```

---

## Campaign registry (`registry.json`)

```json
{
  "schemaVersion": 1,
  "campaigns": [
    { "id": "aw", "menuTitle": "Antiwar 1" },
    { "id": "aw2", "menuTitle": "Antiwar 2" }
  ]
}
```

## Campaign index (`<campaignId>/index.json`)

```json
{
  "schemaVersion": 1,
  "id": "aw",
  "campaignName": "Antiwar 1",
  "mapImage": "assets/campaign/aw/map.png",
  "levels": [
    { "file": "1.json", "name": "Tutorial", "mapX": 188, "mapY": 225, "pathType": 0 },
    { "file": "2.json", "name": "Sector One", "mapX": 600, "mapY": 225, "pathType": 1 }
  ]
}
```

---

## Level pack (`N.json`) — top level

```json
{
  "schemaVersion": 1,
  "id": 1,
  "meta": {
    "name": "Tutorial",
    "author": "Mangoo",
    "description": "How to play Antiwar",
    "thumbnail": "assets/campaign/aw/thumbs/desert.png",
    "difficulty": "easy",
    "arcade": false
  },
  "config": { },
  "bombs": { },
  "airplanes": { },
  "rounds": [ ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `schemaVersion` | yes | Format version for migrations |
| `id` | yes | Matches filename number |
| `meta` | yes | Display info (was config.txt story fields + IMAGE) |
| `config` | yes | Economy, upgrades, assets, sounds |
| `bombs` | yes | Projectile definitions keyed by name |
| `airplanes` | yes | Unit definitions keyed by name |
| `rounds` | yes | Ordered list of rounds (was levels.txt sections) |

---

## `config` — economy & globals

Maps from v1 `config.txt`.

```json
{
  "startLevel": 0,
  "startMoney": 1000,
  "startHumans": 1,
  "startRockets": 3,
  "startHumanHp": 100,
  "startHumanMoney": 300,
  "startRocketPower": 50,
  "startRocketSpeed": 360,
  "startAimTime": 1000,
  "aimPower": 3.0,

  "maxHumans": 10,
  "maxRockets": 10,
  "humanHpRefresh": 1.0,
  "moneyFactor": 1.0,
  "crashingRockets": 2,

  "storyLimits": {
    "maxTime": -1,
    "maxRoundTime": -1,
    "maxRockets": -1,
    "maxRoundRockets": -1,
    "maxHumanDeaths": -1,
    "minMoney": -1
  },

  "buttonsDisabled": {
    "human": false,
    "humanHp": false,
    "humanMoney": false,
    "rocket": false,
    "rocketSpeed": false,
    "rocketPower": false,
    "aim": false
  },

  "upgrades": {
    "human":       { "price": 100, "priceFactor": 1.5, "statFactor": null },
    "humanHp":     { "price": 100, "priceFactor": 1.5, "statFactor": 1.1 },
    "humanMoney":  { "price": 100, "priceFactor": 1.5, "statFactor": 1.15 },
    "rocket":      { "price": 100, "priceFactor": 1.5, "statFactor": null },
    "rocketSpeed": { "price": 100, "priceFactor": 1.5, "statFactor": 1.5 },
    "rocketPower": { "price": 100, "priceFactor": 1.5, "statFactor": 1.5 },
    "aim":         { "price": 100, "priceFactor": 1.5, "statFactor": 0.5 }
  },

  "assets": {
    "tower": "assets/gfx/tower.png",
    "cannon": "assets/gfx/cannon.png",
    "crosshair": "assets/gfx/crosshair1.png",
    "human": "assets/campaign/aw/human.png",
    "explosion": "assets/gfx/explosion.png",
    "explosionNuke": "assets/gfx/explosion_nuke.png",
    "bullet": "assets/gfx/bullet.png",
    "buttonFolder": "assets/gfx/buttons/"
  },

  "sounds": {
    "explosion": ["assets/sfx/explosion2.ogg", "assets/sfx/explosion3.ogg"],
    "scream": ["assets/sfx/bloodscream.ogg"],
    "dieScream": "assets/sfx/bloodscream.ogg",
    "winner": "assets/sfx/winner.ogg",
    "win": "assets/sfx/win.ogg",
    "shoot": "assets/sfx/shoot.ogg",
    "anthrax": "assets/sfx/anthrax.ogg",
    "newRound": "assets/sfx/gong.ogg",
    "music": "assets/sfx/game.ogg",
    "musicVolume": 1.0
  },

  "hpBarColor": { "r": 0, "g": 0, "b": 0 }
}
```

### v1 → JSON field map (config)

| v1 key | JSON path |
|--------|-----------|
| `START_MONEY` | `config.startMoney` |
| `START_HUMANS` | `config.startHumans` |
| `START_ROCKETS` | `config.startRockets` |
| `START_HUMAN_HP` | `config.startHumanHp` |
| `START_HUMAN_MONEY` | `config.startHumanMoney` |
| `START_ROCKET_POWER` | `config.startRocketPower` |
| `START_ROCKET_SPEED` | `config.startRocketSpeed` (px/s; v1 × 60) |
| `START_AIMTIME` | `config.startAimTime` |
| `AIM_POWER` | `config.aimPower` |
| `MAX_HUMANS` | `config.maxHumans` |
| `MAX_ROCKETS` | `config.maxRockets` |
| `PRICE_HUMAN` | `config.upgrades.human.price` |
| `FACTOR_PRICE_HUMAN` | `config.upgrades.human.priceFactor` |
| `FACTOR_HUMAN_HP` | `config.upgrades.humanHp.statFactor` |
| `BUTTON_*_DISABLED` | `config.buttonsDisabled.*` |
| `IMG_TOWER` | `config.assets.tower` |
| `MUSIC` | `config.sounds.music` |

---

## `bombs` — projectiles

Keyed by bomb name. **`BOMB_PLAYER` is required** in every level pack.

**Units:** `speed` is **pixels per second**; `rotationSpeed` is **degrees per second** (360 = one full turn per second).

```json
{
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
      "range": 2.0,
      "lifetime": 20
    },
    "trail": 0,
    "checkOutOfScreen": false,
    "onDeath": { "bomb": null, "count": 0 },
    "feeder": 0
  },

  "BOMB_PLAYER": {
    "image": "assets/gfx/BOMBS/player_rocket.png",
    "scale": [0.5, 0.2],
    "hp": 10,
    "damage": 100,
    "speed": 120,
    "rotationSpeed": 1200,
    "explosion": { "type": 1, "power": 0, "range": 1.0, "lifetime": 20 },
    "trail": 1.0,
    "checkOutOfScreen": true
  }
}
```

| Field | v1 key | Notes |
|-------|--------|-------|
| `speed` | `SPEED` | **px/s** (v1 value × 60 when porting) |
| `rotationSpeed` | `ROTATION_SPEED` | **deg/s** (v1 value × 60 when porting) |
| `damage` | `TP` | Direct hit damage |
| `explosion.type` | `EXPLOSION_TYP` | 0=none, 1=normal, 2=anthrax, 3=nuke, 4=napalm |
| `trail` | `DRAW_SCHWEIF` | Rocket exhaust length; >0 draws trail |
| `checkOutOfScreen` | `CHECK_FOR_OUTOFSCREEN` | true for player rockets |
| `onDeath.bomb` | `EXPLOSION_BOMB` | Submunition type name |
| `onDeath.count` | `EXPLOSION_BOMBCOUNT` | |
| `feeder` | `IS_FEEDER` | Human knockback strength |

Player rocket **effective** speed and damage come from runtime upgrades (`startRocketSpeed`, `startRocketPower`, lock-on multiplier) applied on top of `BOMB_PLAYER`.

---

## `airplanes` — units

**Units:** `speed` is **px/s**; `rotationSpeed` is **deg/s**; `aiConfig.dropIntervalSec` is **average seconds between weapon drops** (for standard AIs).

```json
{
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
    "scale": [0.6, 0.6],
    "stealthPhaseSec": 0,
    "explosion": { "type": 1, "power": 1, "range": 4.0, "lifetime": 50 },
    "isBloody": false,
    "carrier": false,
    "scream": null,
    "lastScream": null
  }
}
```

| Field | v1 key | Notes |
|-------|--------|-------|
| `speed` | `SPEED` | **px/s** (v1 × 60) |
| `rotationSpeed` | `ROTATION_SPEED` | **deg/s** (v1 × 60); unused for `drawStyle` 0 bombers |
| `weapons` | `BOMB_TYP_0`, `BOMB_TYP_1`, … | Array of bomb names |
| `ai` | `KI` | See [08-ai-types.md](./08-ai-types.md) |
| `aiConfig` | `KI_PARAM_*` | Named AI tuning — see below |
| `aiConfig.flightBand` | `KI_PARAM_A/B` (Y band) | `{ minY, maxY }` in px |
| `aiConfig.dropIntervalSec` | `KI_PARAM_C` | Seconds between drops (v1 C ÷ 60) |
| `aiConfig.glideTarget` | `KI_PARAM_A/B` (PARACHUTE) | `{ startX, endX }` in px |
| `drawStyle` | `DRAWSTYLE` | 0=bomber flip, 1=fighter rotate, 2=heli tilt |
| `stealthPhaseSec` | `IS_STEALTHED` | Seconds per stealth/visible phase; 0 = off |
| `carrier` | `CARRIER` | 0=bombs, 1=spawns child planes |

Helpers use the same schema (v1 `HELPER_N` spawns — unused in shipped content but supported).

---

## `rounds` — wave definitions

Each entry = one v1 `[ROUND_NAME]` section. **Array order = play order.** Section names are labels only.

```json
{
  "name": "ONE SHOOT",
  "weather": [0, 0, 0, 0, 0],
  "background": "assets/campaign/aw/backgrounds/mangoo.jpg",
  "ground": "assets/campaign/aw/backgrounds/ground.png",
  "intro": {
    "text": "shoot your enemy",
    "image": "assets/gfx/AIRPLANES/bomber.png",
    "time": 300,
    "sound": "assets/sfx/tutorial/shootall.ogg"
  },
  "winSound": "assets/sfx/tutorial/buyupgrades.ogg",
  "music": null,
  "musicVolume": null,
  "maxAirplanes": 0,
  "endmaster": -1,
  "rumble": 2,
  "buttonsDisabled": {},
  "storyLimits": {},
  "spawns": [
    { "kind": "airplane", "type": "BOMBER", "x": -188, "y": 141, "angle": 0 },
    { "kind": "airplane", "type": "BOMBER", "x": 2250, "y": 141, "angle": 0 }
  ]
}
```

### Round fields

| Field | v1 key | Default | Description |
|-------|--------|---------|-------------|
| `weather` | `WEATHER` | `[0,0,0,0,0]` | `[rain, clouds, snow, wind, darkness]` |
| `background` | `CHANGE_BACKGROUND` / `BACKGROUND` | — | JPG/PNG path |
| `ground` | `CHANGE_GROUND` | `ground.png` | Ground strip image |
| `music` | `CHANGE_MUSIC` | — | Track under `assets/sfx/` |
| `musicVolume` | `CHANGE_VOLUME` | — | Level music gain (sticky) |
| `sounds` | — | — | Partial SFX bank override (sticky) |
| `intro.time` | `INTRO_TIME` | 0 | **Milliseconds** intro overlay duration |
| `maxAirplanes` | `MAX_AIRPLANES` | 0 | 0 = spawn all; N = concurrent limit + queue |
| `endmaster` | `ENDMASTER` | -1 | Spawn index for boss HP bar (≥0) |
| `rumble` | `RUMBLE` | 2 | 0=off, 1=planes only, 2=all explosions |

### Spawn entries

```json
{ "kind": "airplane", "type": "BOMBER", "x": -188, "y": 141, "angle": 0 }
{ "kind": "helper",   "type": "ALADIN", "x": 960, "y": 400, "angle": 0 }
```

v1 format: `AIRPLANE_0: BOMBER,-100,100,0` → split on comma after type name.

Spawn indices are **array order** in JSON (no gaps required).

---

## Spawn queue semantics

When `maxAirplanes` is **0**: all spawns enter play at round start.

When `maxAirplanes` is **N > 0**:

1. Activate spawns 0 … N−1
2. When an airplane is destroyed, activate the next queued spawn
3. Repeat until all spawns exhausted and all active planes destroyed → round win

---

## Validation rules

The loader should reject or warn on:

- Missing `BOMB_PLAYER`
- Spawn `type` not found in `airplanes`
- Airplane `weapons[]` entry not found in `bombs`
- Empty `rounds` array
- Unknown `ai` string

---

## Example: minimal valid `1.json`

See `public/assets/campaign/aw/1.json` for a converted tutorial pack.

Conversion procedure: [04-v1-porting.md](./04-v1-porting.md)
