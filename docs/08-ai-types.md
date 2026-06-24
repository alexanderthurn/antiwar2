# 08 — AI Types

Enemy flight and attack patterns from v1. All AIs are **hardcoded in the engine** — level JSON only references them by name.

Implement as TypeScript classes with a common interface:

```typescript
interface AIBehavior {
  update(plane: Airplane, dt: number): void;
}
```

Parameters come from `airplane.aiParams` → `[A, B, C]`.

---

## Standard parameters

Most bombers/fighters/helicopters use:

| Param | Meaning |
|-------|---------|
| A | `startY` — lower bound of flight band |
| B | `endY` — upper bound of flight band |
| C | `randFactor` — 1/C chance per tick to fire weapon |

Planes fly between waypoints generated in the Y band between A and B.

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
- 1 weapon

### FIGHTERLIZZARD

- Dive attack from high altitude
- MG during dive + **3 missiles** near turn point
- **2 weapons** (`BOMB_TYP_0`, `BOMB_TYP_1`)
- **Used in:** mangoo2, xr, arcade

### CARRIER

- Spawns child interceptor planes instead of (or in addition to) bombs
- `carrier: 1` on airplane definition
- Children die when parent destroyed (v1.22+)
- **Used in:** mangoo2, nuke, arcade

### PARACHUTE

- Different params: **A = startX, B = endX**, C unused
- Flies to ground at target X, explodes on impact (kamikaze)
- 0 weapons
- **Used in:** mangoo2, arcade

---

## Boss AIs

Scripted patterns — port by studying `old/data/boss*/airplanes.txt` and `levels.txt`. Not waypoint-based.

### Baron (`KI: Baron`)

- **Campaign:** boss1, arcade
- Dual weapons: `BOMB_OLD`, `ROCKET_COLA`
- `drawStyle: 1` (fighter rotation)
- Large HP (~20000 in boss1)
- Nuke explosion on death
- Special "Cola attack" pattern (flies outside screen — tuned in v37)

### Vogel (`KI: Vogel`)

- **Campaign:** boss2
- Dual weapons
- Final rage attack — dive depth reduced in v37

### RICE (`KI: RICE`)

- **Campaign:** boss3
- Custom projectile: `quantum2.png` rocket skin
- Laser/phaser attacks (v1.1: primary shot changed to laser)
- Strengthened phasers in v37

### BUSH (`KI: BUSH`)

- **Campaign:** boss4
- Bombs from sky (not only from plane)
- +50% HP and stronger bombs in v37
- Supporting `FIGHTERSIMPLE` escorts in boss4 pack

Boss implementations will likely need **phase state machines** (inspect original behavior via playtesting old binary or iterative tuning).

---

## AI name normalization

Data files are inconsistent. Map all aliases in `AIDispatcher`:

| In data files | Canonical |
|---------------|-----------|
| `BOMBERSIMPLE` | `BOMBERSIMPLE` |
| `BOMBERHARD` | `BOMBERHARD` |
| `KIHELISIMPLE` / `HELISIMPLE` | `HELISIMPLE` |
| `KIHELIAPACHE` / `HELIAPACHE` | `HELIAPACHE` |
| `KIFIGHTERLIZZARD` / `FIGHTERLIZZARD` | `FIGHTERLIZZARD` |
| `KICARRIER` / `CARRIER` | `CARRIER` |
| `KIPARACHUTE` / `PARACHUTE` | `PARACHUTE` |
| `Baron` / `BARON` | `Baron` |
| `Vogel` | `Vogel` |
| `RICE` | `RICE` |
| `BUSH` | `BUSH` |

---

## Implementation priority

| Priority | AI | Reason |
|----------|-----|--------|
| P0 | BOMBERSIMPLE | Tutorial + first levels |
| P1 | FIGHTERSIMPLE, HELISIMPLE | Early mangoo_easy |
| P2 | BOMBERHARD, HELIAPACHE | Mid campaign |
| P3 | FIGHTERLIZZARD, CARRIER, PARACHUTE | mangoo2+ |
| P4 | Baron, Vogel, RICE, BUSH | Boss levels |

---

## Firing logic (shared)

For standard AIs with `randFactor = C`:

```
each tick: if random(0, C) === 0 → drop bomb from weapons[0]
```

Multi-weapon planes (Lizzard, Baron):

- Primary weapon on ground strafe timer
- Secondary on dive phase or separate timer

Exact timings — tune against v1 gameplay feel.

---

## Testing each AI

1. Create debug round JSON with single spawn of that type
2. Verify flight stays in Y band [A, B]
3. Verify bombs drop at expected rate
4. Verify plane flips/rotates per `drawStyle`
5. Compare travel speed to `airplane.speed`

Debug round example:

```json
{
  "name": "DEBUG_BOMBER",
  "spawns": [{ "kind": "airplane", "type": "BOMBER", "x": -188, "y": 141, "angle": 0 }],
  "maxAirplanes": 0
}
```
