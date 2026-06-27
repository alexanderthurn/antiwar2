# 08 — AI Types

Enemy flight and attack patterns from v1. All AIs are **hardcoded in the engine** — level JSON only references them by name.

```typescript
interface AIBehavior {
  update(plane: Airplane, dt: number): void;
}
```

Parameters come from `airplane.aiConfig` (named fields, not index slots).

---

## Standard parameters

Most bombers/fighters/helicopters use:

```json
"aiConfig": {
  "flightBand": { "minY": 0, "maxY": 422 },
  "dropIntervalSec": 10
}
```

| Field | Unit | Meaning |
|-------|------|---------|
| `flightBand.minY` | px | Bottom of vertical patrol band |
| `flightBand.maxY` | px | Top of patrol band |
| `dropIntervalSec` | s | Average time between primary weapon drops |

Planes drift between random altitudes in the Y band.

**Parachute** uses `glideTarget` instead:

```json
"aiConfig": {
  "glideTarget": { "startX": 0, "endX": 960 }
}
```

---

## Standard AIs

### BOMBERSIMPLE

- Flies left ↔ right across screen
- Changes altitude outside umbrella coverage
- 1 weapon
- **Used in:** tutorial, mangoo_easy (most common)

### BOMBERRANDOM

- Like BOMBERSIMPLE but changes altitude **3 times** per crossing
- 1 weapon

### BOMBERHARD

- Carpet bomber — drops **5 spread bombs** in one pass
- 1 weapon
- **Used in:** mangoo_easy, mangoo2, xr, nuke, arcade

### FIGHTERSIMPLE

- Erratic movement in flight band
- Shoots primary weapon at ground periodically
- 1 weapon
- **Used in:** mangoo_easy (fighters), xr

### HELISIMPLE

- Horizontal left ↔ right (simple helicopter)
- 1 weapon
- Note: v1 SDK says `KIHELISIMPLE`; data files use `HELISIMPLE`

### HELIAPACHE

- Attack run: starts high at screen edge, dives, climbs out other side
- 1 weapon — uses `flightBand` only (`dropIntervalSec` ignored; burst at dive bottom)

### FIGHTERLIZZARD

- Dive attack from high altitude
- MG during dive + **3 missiles** near turn point
- **2 weapons** (`weapons[0]`, `weapons[1]`)
- **Used in:** mangoo2, xr, arcade

### CARRIER

- Spawns child interceptor planes instead of (or in addition to) bombs
- `weapons[0]` = child airplane type
- Uses `flightBand` only — spawns every ~2.5 s (engine default)

### PARACHUTE

- `glideTarget: { startX, endX }` — horizontal glide, ground detonation
- `weapons[0]` = bomb on impact
- **Used in:** mangoo2, arcade

---

## Boss AIs

Scripted patterns — port by studying boss level packs. Use `flightBand` + `dropIntervalSec` plus hardcoded phase timers in code.

### Baron (`KI: Baron`)

- **Campaign:** boss1, arcade
- Dual weapons
- `drawStyle: 1` (fighter rotation)

### Vogel (`KI: Vogel`)

- **Campaign:** boss2
- Dual weapons

### RICE (`KI: RICE`)

- **Campaign:** boss3
- Custom projectile patterns

### BUSH (`KI: BUSH`)

- **Campaign:** boss4
- Bombs from sky + patrol drops

---

## AI name normalization

| In data files | Canonical |
|---------------|-----------|
| `BOMBERSIMPLE` | `BOMBERSIMPLE` |
| `KIHELISIMPLE` / `HELISIMPLE` | `HELISIMPLE` |
| `KIHELIAPACHE` / `HELIAPACHE` | `HELIAPACHE` |
| `KIFIGHTERLIZZARD` / `FIGHTERLIZZARD` | `FIGHTERLIZZARD` |
| `KICARRIER` / `CARRIER` | `CARRIER` |
| `KIPARACHUTE` / `PARACHUTE` | `PARACHUTE` |
| `Baron` / `BARON` | `BARON` |

---

## Firing logic (shared)

For standard AIs with drop interval `C` seconds:

```
each frame: if random() < dt / C → drop bomb from weapons[0]
```

When porting from v1: `dropIntervalSec = KI_PARAM_C / 60`.

Multi-weapon planes (Lizzard, Baron):

- Primary weapon on `dropIntervalSec` roll
- Secondary on dive phase or separate timer

---

## Testing each AI

1. Create debug round JSON with single spawn of that type
2. Verify flight stays in `flightBand`
3. Verify bombs drop at expected rate (`dropIntervalSec`)
4. Verify plane flips/rotates per `drawStyle`
5. Compare travel speed to `airplane.speed` (px/s)

Debug round example:

```json
{
  "name": "DEBUG_BOMBER",
  "spawns": [{ "kind": "airplane", "type": "BOMBER", "x": -188, "y": 141, "angle": 0 }],
  "maxAirplanes": 0
}
```
