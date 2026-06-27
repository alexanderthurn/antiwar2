# Campaign level format

Each `N.json` file is a self-contained **level pack**: economy, units, bombs, and an ordered list of **rounds** (stages). Coordinates are in design space **1920×1080**.

**Authoring guide (players & modders):** [`public/web/level-authoring.md`](../web/level-authoring.md) — full English tutorial with `aiConfig` and per-second units.

See also `registry.json` and each `<campaignId>/index.json` for map placement. Full schema notes live in `docs/03-data-format.md`; this file focuses on **per-round overrides** added for v1 parity.

---

## File layout

```
public/campaign/
  registry.json          # menu: [{ "id": "aw", "menuTitle": "..." }, …]
  format.md              # this file
  aw/
    index.json           # map + level list for Antiwar 1
    1.json …             # level packs
  aw2/
    index.json
    1.json …
```

Level URLs at runtime: `campaign/<id>/N.json` (loaded via `loadLevelPack(campaignId, file)`).

---

## Level defaults (`config`)

Shared for the whole level unless a round overrides them.

### Visuals — `config.assets`

| Field | Default | Description |
|-------|---------|-------------|
| `background` | `assets/gfx/backgrounds/mangoo.jpg` | Sky / backdrop image |
| `ground` | `assets/gfx/backgrounds/ground.png` | Ground strip at bottom |
| `tower`, `cannon`, `crosshair`, `human` | — | Gameplay sprites |

### Audio — `config.sounds`

Partial object; unset keys use engine defaults (`game.ogg`, `gong.ogg`, etc.).

| Field | v1 key | Description |
|-------|--------|-------------|
| `music` | `MUSIC` | Looping background track (relative to `assets/sfx/`) |
| `musicVolume` | `MUSIC_VOLUME` | Level gain × user music slider (default `1`) |
| `explosion` | — | Array of explosion one-shots |
| `scream`, `dieScream` | — | Civilian hit / death |
| `shoot`, `anthrax` | — | Rocket fire / anthrax hits |
| `newRound` | — | Gong between rounds |
| `winner`, `win` | — | Round / level complete |
| `pay`, `noMoney`, `gameOver` | — | Shop & fail feedback |

---

## Rounds (`rounds[]`)

Each entry is one stage (v1 `[SECTION]` in `levels.txt`). Array order = play order.

### Sticky overrides

These fields use **sticky** semantics (same as v1 `CHANGE_*`): when set on a round, the value applies to **that round and all later rounds** until another round changes it.

| JSON field | v1 key | Example |
|------------|--------|---------|
| `background` | `CHANGE_BACKGROUND`, `BACKGROUND` | `"assets/gfx/backgrounds/desert.jpg"` |
| `ground` | `CHANGE_GROUND` | `"assets/gfx/backgrounds/ground2.png"` |
| `music` | `CHANGE_MUSIC` | `"boss.ogg"` |
| `musicVolume` | `CHANGE_VOLUME` | `0.8` |
| `sounds` | — | `{ "newRound": "custom_gong.ogg" }` |

Omit fields on rounds that should keep the previous value — keeps JSON small.

**`sounds` on a round** is a partial patch merged into the level SFX bank (explosion list, shoot, newRound, …). Later rounds can patch again.

### Per-round only (not sticky)

| JSON field | v1 key | Description |
|------------|--------|-------------|
| `intro.sound` | `INTRO_SOUND` | One-shot during round intro |
| `winSound` | — | One-shot when the round is won |

### Other common round fields

`weather`, `maxAirplanes`, `endmaster`, `rumble`, `spawns`, `intro.text`, `intro.image`, `intro.time` (ms) — see `docs/03-data-format.md`.

### Time units in level JSON

| Field | Unit |
|-------|------|
| `speed`, `startRocketSpeed` | pixels per second |
| `rotationSpeed` | degrees per second (360 = one full turn/s) |
| `aiConfig.dropIntervalSec` | seconds between weapon drops |
| `aiConfig.flightBand` | vertical patrol range (px) |
| `aiConfig.glideTarget` | parachute horizontal targets (px) |
| `stealthPhaseSec` | seconds per stealth/visible phase |
| `intro.time`, `startAimTime`, `storyLimits.*Time` | milliseconds |

---

## Examples

### Desert backdrop from round 6 onward

```json
{
  "config": {
    "assets": {
      "background": "assets/gfx/backgrounds/mangoo.jpg",
      "ground": "assets/gfx/backgrounds/ground.png"
    }
  },
  "rounds": [
    {
      "name": "TUTORIAL",
      "background": "assets/gfx/backgrounds/mangoo.jpg",
      "spawns": []
    },
    {
      "name": "MISSION",
      "background": "assets/gfx/backgrounds/desert.jpg",
      "spawns": [{ "kind": "airplane", "type": "BOMBER_HARD", "x": 188, "y": -141, "angle": 0 }]
    }
  ]
}
```

### Boss music at level scope

```json
{
  "config": {
    "sounds": {
      "music": "boss.ogg",
      "musicVolume": 0.8
    }
  }
}
```

### Switch music mid-campaign

```json
{
  "config": {
    "sounds": { "music": "game.ogg" }
  },
  "rounds": [
    { "name": "PART ONE", "spawns": [] },
    {
      "name": "FINALE",
      "music": "boss.ogg",
      "musicVolume": 0.8,
      "spawns": []
    }
  ]
}
```

### Custom round-transition SFX

```json
{
  "rounds": [
    {
      "name": "SPECIAL",
      "sounds": { "newRound": "tutorial/buyupgrades.ogg" },
      "spawns": []
    }
  ]
}
```

---

## Path conventions

- Backgrounds / ground: `assets/gfx/backgrounds/<file>`
- Music & SFX in `config.sounds` and round `music`: relative to `assets/sfx/` (e.g. `"boss.ogg"` → `assets/sfx/boss.ogg`)
- Sprites: `assets/gfx/...` as elsewhere in the pack

---

## Buy macros (shop)

Keys **1–9** on the upgrade shop buy predefined upgrade sequences (v1 `buyscript.txt` `[STANDARD]`). Not configurable.

| Key | Purchases |
|-----|-----------|
| 1 | Civilian |
| 2 | Civilian HP |
| 3 | Survivor pay |
| 4 | Rocket slot |
| 5 | Rocket speed |
| 6 | Rocket power |
| 7 | Lock speed |
| 8 | 6× Civilian |
| 9 | One of each upgrade |

Multi-item macros apply a **100ms × step** delay before each purchase after the first. Works with main keyboard and numpad digits.

---

| v1 (`levels.txt`) | JSON |
|-------------------|------|
| `[ROUND NAME]` | `rounds[].name` |
| `CHANGE_BACKGROUND:` / `BACKGROUND:` | `rounds[].background` |
| `CHANGE_GROUND:` | `rounds[].ground` |
| `CHANGE_MUSIC:` | `rounds[].music` |
| `CHANGE_VOLUME:` | `rounds[].musicVolume` |
| `INTRO_SOUND:` | `rounds[].intro.sound` |
| `MUSIC:` (in `config.txt`) | `config.sounds.music` |
| `MUSIC_VOLUME:` (in `config.txt`) | `config.sounds.musicVolume` |

Conversion procedure: `docs/04-v1-porting.md`.
