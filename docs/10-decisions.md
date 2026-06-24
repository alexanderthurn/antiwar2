# 10 — Locked Design Decisions

Answers confirmed by project owner. Update this file if decisions change.

> **Note:** Theme sections below originally described a Ukraine/NATO reskin. **Shipped build uses v1 Antiwar framing** (“evil planes attack”). Mechanics decisions still apply.

---

## Multiplayer layout

**Q:** 10 turrets at 5 players — too crowded?  
**A:** OK. Use colored player rings at turret bases for clarity.

---

## Rocket pool (split across active players)

**Q:** Shared or per-player `maxRockets`?  
**A:** **Split per active player** from a team total. Use **fair distribution** so remainder rockets are assigned, not dropped.

```typescript
/** e.g. 5 rockets, 2 players → [3, 2]; 5 rockets, 3 players → [2, 2, 1] */
function distributeRocketCaps(maxRockets: number, activePlayers: number): number[] {
  if (activePlayers <= 0) return [];
  const base = Math.floor(maxRockets / activePlayers);
  const remainder = maxRockets % activePlayers;
  return Array.from({ length: activePlayers }, (_, i) =>
    base + (i < remainder ? 1 : 0)
  );
}
```

Cap assignment uses **fair split + remainder to lowest cap** (tie-break: lower slot index). Keeps P1 ahead when tied; if P1 absent, P2 benefits.

```typescript
function distributeRocketCaps(maxRockets: number, activeSlots: number[]): number[] {
  const n = activeSlots.length;
  if (n === 0) return [];
  const caps = Array(n).fill(Math.floor(maxRockets / n));
  let remainder = maxRockets % n;
  while (remainder > 0) {
    const minCap = Math.min(...caps);
    const i = caps.findIndex((c) => c === minCap); // lowest slot on tie
    caps[i]++;
    remainder--;
  }
  return caps;
}
```

Examples: 5 rockets, 2 players → `[3, 2]`. 5 rockets, 3 players → `[2, 2, 1]`.

### When a player leaves

Recalculate caps for **remaining** players from team `maxRockets` using the same algorithm. In-flight rockets keep flying; no new shots until under new cap. Keep logic simple — full recalc, no manual transfer of individual rockets.

### When a slot frees up

A player can fire again when one of their in-flight rockets:

1. **Explodes** (hit target or ground), or
2. **Leaves the screen** (`BOMB_PLAYER.checkOutOfScreen: true` — same as v1)

Each rocket is tracked against that player's personal cap. No shared queue between players.

### Dynamic recalculation

When a player **joins** or **leaves**, recalculate caps with `distributeRocketCaps`. In-flight rockets above the new cap finish naturally; no new fires until under cap.

Upgrades increase team `maxRockets` → redistributed on next shop phase (or immediately on join/leave).

---

## Gamepad crosshair release

**A:** **Stay put** — releasing the stick does not move or recenter the crosshair. Absolute mapping only updates while stick is deflected beyond deadzone.

---

## Campaign structure

**A:** **One campaign only.** Between **levels** (JSON missions), player returns to **campaign view** (hub/map). Between **rounds** within a level → upgrade shop. See [PLAN.md](./PLAN.md).

---

## Touch controls

**A:** One finger = aim crosshair; two on-screen buttons = left / right turret fire.

---

## Player names

**A:** **P1, P2, …** only — no nicknames.

---

## Multiplayer scope

**A:** **Local only** — no online networking in v1.

---

## Pause audio

**A:** **Keep music playing** during pause overlay.

---

## Round fail / game over

**A:** **Instant game over** when all civilians are dead (→ main menu). No in-round retry.

---

## Campaign flow (supersedes earlier)

**A:** ~~Return to main menu after each campaign file~~ → **Campaign view** between levels. Main menu only on launch, quit, or game over.

---

## Save progress

~~Full localStorage save~~ → **No save.** Fresh start each session. Settings only.

---

## Language

**A:** **English only** for first release.

---

## Platform

**A:** **Desktop browser + touch** (tablets: finger aim + fire buttons).

---

## Pause UI

**A:** **Any player** pauses with Escape or gamepad Start. Pixi overlay. Music continues when audio is enabled.

---

## Shop mid-join

**A:** Allowed. No extra gate — same **Continue** button starts the next round.

---

## Theme

**A:** **v1 Antiwar** — generic “evil planes attack”; reuse v1 assets and copy. (Ukraine/NATO reskin was considered and dropped.)

---

## Autofire

**A:** **Hold** L/R (mouse or LB/RB) to repeat fire while under rocket cap.

---

## Assets

**A:** **Reuse v1** scaled for 1080p now; faction-themed HD redraw later.

---

## Mid-round join

**A:** **Immediately** — crosshair + turrets on next frame.

---

## Upgrade shop continue

**A:** **Continue** button on the shop overlay → next round immediately. Any active player can press it.

---

## Gamepad-only sessions

**A:** Slot 0 empty; gamepads use slots 1–4.

---

## Gamepad aim

**A:** **Absolute** stick → crosshair position; sensitivity in settings.

---

## Mouse join

**A:** **Explicit join** — same as gamepads.

---

## Campaign view

**A:** **Reuse v1 map UI** — `gfx/map.png` node layout from `campaign.txt` coordinates.

---

## Faction / defender

**A:** Players defend **civilians on the ground** from attacking aircraft (v1 framing).

---

## Save game

**A:** **No save at all** — no campaign progress persistence. Every run starts fresh from main menu. Settings only persist in localStorage (`antiwar2_settings`).

---

## Rocket +1 priority

**A:** ~~P1 always~~ → **Lowest cap gets +1** when splitting remainder (tie → lower slot). On leave/kick, **recalculate** caps for remaining players. Keep implementation simple.

---

## Attacking faction

**A:** **Russia explicitly named** as attacker (aircraft, briefings, UI where appropriate).

---

## Economy between levels

**A:** **Reset per level** — each JSON mission starts with that file's `config` start values (money, humans, rockets, upgrades). No carry-over on campaign map.

Within a level, money/upgrades **do** carry between rounds (shop).

---

## Session quit

**A:** Quit to main menu (pause or campaign map) = **lose all session progress**. No save.

---

## Bosses

**A:** Reuse v1 boss AI patterns on levels 3, 6, 9, 12 (`BARON`, `VOGEL`, `RICE`, `BUSH`). Characters/sprites stay v1-style for now.

---

## Solo + co-op join

**A:** **Solo P1 stays** when others join. Join/leave is **minimal code**: show/hide that player's two turrets + crosshair; **recalculate rocket caps** for all active players. No complex lobby state.

---

## Gamepad aim bounds

**A:** Crosshair only moves inside the **1920×1080 game area** — black letterbox bars are **out of bounds**.

---

## Game modes

**A:** **Single mode only** for now — no hardcore, arcade, or time attack. Cut extras until campaign works.

---

## Audio / assets

**A:** **Reuse all v1** gfx/sfx where possible, including kill streak VO (`doublekill.ogg`, etc.).

---

## Campaign map unlock

**A:** **Linear only** — complete level N to unlock N+1 on the map (in current session).

---

## Credits

**A:** **Alexander Thurn** + fictionalized-conflict disclaimer (credits screen ships as-is).

---

## Starting a level

**A:** **Solo auto** — mouse player implicit P1 without join click. Co-op: explicit join per player.

---

## Crosshair on join

**A:** **Screen center** (design 960, 540).

---

## Kick players

**A:** **Player icons** in main menu + pause — click to kick. Kicked player may rejoin anytime. Rocket caps recalculate.

---

## Story limits

**A:** **Keep** v1 `STORY_MAX_*` from level JSON when set.

---

## Arcade / time attack

**A:** **Cut** for v1.

---

## First build target

**A:** Tutorial vertical slice — `1.json`, round 1, mouse dual-turret.

---

## Related docs

These decisions are reflected in:

- [06-multiplayer.md](./06-multiplayer.md)
- [07-game-mechanics.md](./07-game-mechanics.md)
## Related docs

- [PLAN.md](./PLAN.md)
- [03-data-format.md](./03-data-format.md)
- [06-multiplayer.md](./06-multiplayer.md)
- [07-game-mechanics.md](./07-game-mechanics.md)
