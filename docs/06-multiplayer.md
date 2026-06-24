# 06 — Multiplayer

Up to **5 co-op players** on one shared battlefield. No versus mode. Shared civilians, money, and upgrades.

---

## Player slots

| Slot | Device | Notes |
|------|--------|-------|
| 0 | Mouse + keyboard | Optional — game is fully playable with gamepads only |
| 1 | Gamepad 0 | |
| 2 | Gamepad 1 | |
| 3 | Gamepad 2 | |
| 4 | Gamepad 3 | |

**Each active player controls 2 turrets** (left + right). Maximum **10 turrets** on screen at once.

Gamepad index ≠ slot index when mouse slot is empty: first gamepad typically takes slot 1.

---

## Turret layout

All turrets sit on `DESIGN.groundY`. Player 1 uses bottom corners; each additional player shifts inward.

```typescript
const BASE_LEFT  = 60;
const BASE_RIGHT = 1860;
const INSET_PER_PLAYER = 160;

function turretX(playerSlot: number) {
  const inset = playerSlot * INSET_PER_PLAYER;
  return { left: BASE_LEFT + inset, right: BASE_RIGHT - inset };
}
```

| Slot | Left X | Right X |
|------|--------|---------|
| 0 (P1) | 60 | 1860 |
| 1 (P2) | 220 | 1700 |
| 2 (P3) | 380 | 1540 |
| 3 (P4) | 540 | 1380 |
| 4 (P5) | 700 | 1220 |

### Visual distinction

Each player gets:

- Unique crosshair color
- Colored ring at turret base
- Small label (`P1` … `P5`) near crosshair or turrets

---

## Input mapping

### Mouse (slot 0)

| Action | Input |
|--------|-------|
| Aim | Cursor position (design coords after letterbox transform) |
| Left turret | Left mouse button |
| Right turret | Right mouse button |

### Gamepad (slots 1–4)

| Action | Input |
|--------|-------|
| Aim | Left analog stick → absolute crosshair on screen |
| Left turret | L1 / LB |
| Right turret | R1 / RB |

### Touch (tablet)

| Action | Input |
|--------|-------|
| Aim | One finger drag on playfield |
| Left turret | On-screen button (left) |
| Right turret | On-screen button (right) |

Touch player occupies a slot like mouse/gamepad (explicit join if multiple touch users — typically one touch + pads).

---

| Action | Input |
|--------|-------|
| Left turret | Arrow left |
| Right turret | Arrow right |

(v1 supported this when only one mouse button exists.)

---

## Crosshair

**Every player has their own crosshair.** Lock-on state is per player, per target.

### Mouse player

Crosshair follows pointer, clamped to design bounds.

### Gamepad player

**Absolute stick mapping** (confirmed):

- Stick X/Y map to crosshair position on the playfield (e.g. stick fully right → crosshair near right edge)
- Apply deadzone ~0.15 on stick before mapping
- Clamp crosshair to design bounds
- Sensitivity multiplier from settings (`gamepadAimSensitivity`)
- **Release stick → crosshair stays put** (no snap to center)

### Lock-on (shared rules, per-player state)

1. Crosshair overlaps an enemy
2. Hold aim on target for `currentAimTime` ms
3. Crosshair turns red → next rockets from that player are guided + damage bonus
4. See [07-game-mechanics.md](./07-game-mechanics.md)

---

## Join / leave (keep code simple)

```typescript
function joinPlayer(slot: PlayerSlot) {
  slot.active = true;
  slot.turrets.visible = true;
  slot.crosshair.visible = true;
  slot.crosshair.setPosition(960, 540);
  redistributeRocketCaps();
}

function leavePlayer(slot: PlayerSlot) {
  slot.active = false;
  slot.turrets.visible = false;
  slot.crosshair.visible = false;
  redistributeRocketCaps();
}
```

- **Solo:** mouse active without join click (slot 0 implicit until kicked)
- **Co-op:** explicit join; adding P2 does not unseat P1
- **Kick:** same as `leavePlayer` — can rejoin via join flow
- No separate lobby FSM — flags + visibility + cap array

**Kick:** click player icon → `leavePlayer`. **Disconnect:** 2s grace → `leavePlayer`. Rejoin anytime.

---

## Shared vs per-player resources

| Resource | Shared? |
|----------|---------|
| Civilians | Yes |
| Money | Yes |
| Upgrades | Yes |
| Rocket pool (`maxRockets`) | **Split** — team total ÷ active players (see below) |
| Crosshair / aim | No — per player |
| Lock-on progress | No — per player |
| Stats | Tracked per player, displayed separately |

Each player has a personal cap from **fair split** of team total:

```typescript
// Remainder → player(s) with lowest cap; tie → lower slot index
// On leave: recalculate for remaining players only
function distributeRocketCaps(maxRockets: number, activePlayerSlots: number[]): number[]
```

Team total in flight never exceeds `maxRockets`. Slot frees on explode or off-screen.

---

## Co-op stats

Tracked per player for the session and shown on round-end overlay + pause menu.

| Stat | When incremented |
|------|------------------|
| `rocketsFired` | Player fires left or right turret |
| `hits` | Player's rocket damages enemy or bomb |
| `kills` | Player's rocket destroys airplane (credit last hit) |
| `bombsDestroyed` | Player destroys falling bomb before impact |
| `lockOnKills` | Kill while guided rocket active |
| `damageDealt` | Sum of damage applied |

Shared session stats: civilians alive, money, score, unstoppable streak, humans lost.

### Rocket ownership

Every rocket entity stores `ownerId` (player slot) for stat attribution.

---

## Join UI

Persistent panel (menu + in-game):

```
┌─ Players ─────────────────┐
│ P1 ●  Mouse      [active] │
│ P2 ●  Gamepad 1  [active] │
│ P3 ○  —          [Press A]│
│ P4 ○  —          [Press A]│
│ P5 ○  —          [Press A]│
└───────────────────────────┘
```

Persistent **player slot icons** on main menu and pause overlay:

- Show P1–P5 with color / device icon when active
- **Click icon → kick** (same as leave + slot freed)
- Kicked player can rejoin anytime from join panel

Join panel and kick icons share the same slot state.

---

## Upgrade shop (multiplayer)

Between rounds, all active players share the upgrade shop (shared money, any player can buy).

**Continue rule:** pressing **Continue → next round** (or **Finish tutorial**) starts the next step immediately. No per-player ready gate.

- Any active player can buy upgrades until someone continues
- 100ms buy penalty (v1) applies per purchase
- If a player leaves during shop, they are removed from the active roster; continue still works for whoever remains

---

## Edge cases

| Case | Behavior |
|------|----------|
| 0 players | Should not happen in-game; return to menu if all leave |
| 1 player | Normal solo (2 turrets) |
| 5 players | 10 turrets — verify readability; may overlap visually |
| Player leaves during shop | Shop continues; slot freed |
| All humans dead | Round lost / game over (same as v1) |

---

## Implementation checklist

- [ ] `PlayerSlot` class with lifecycle (empty → active → empty)
- [ ] Poll gamepads every frame in game loop
- [ ] Map screen coords through `Viewport.screenToDesign()` for mouse
- [ ] `TurretPair` per active slot
- [ ] `Crosshair` per active slot with lock-on timer
- [ ] `SessionStats` with per-slot counters
- [ ] Join UI + player icons (kick on click in menu/pause)
- [ ] Disconnect detection with grace period
