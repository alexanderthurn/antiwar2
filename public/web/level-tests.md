# Level test links

Quick jumps into the **aw** campaign via dev URL (`?level=&round=`). Links open the game in a new tab using the current host.

Every link pre-applies test upgrades: **+5 humans**, **+3 rockets**, **+3 rocket power** (stronger bombs).

Campaign level numbers match the map order in `public/assets/campaign/aw/index.json` (1 = Training, 8 = XR, …).

---

## Weather

| Feature | Level | Round | Link |
|---------|-------|-------|------|
| Rain | 2 — Sector One | 4 | [play](play:2:4) |
| Rain (heavy) | 2 — Sector One | 14 | [play](play:2:14) |
| Clouds | 2 — Sector One | 2 | [play](play:2:2) |
| Wind | 2 — Sector One | 6 | [play](play:2:6) |
| Night / darkness | 2 — Sector One | 14 | [play](play:2:14) |
| Night vision | 5 — Sector Two | 13 | [play](play:5:13) |
| Snow | 8 — XR | 14 | [play](play:8:14) |
| Rain + napalm (“RAINY DAYS”) | 8 — XR | 4 | [play](play:8:4) |

---

## Bombs & explosions

| Feature | Level | Round | Link |
|---------|-------|-------|------|
| Napalm bombers | 8 — XR | 4 | [play](play:8:4) |
| Carpet napalm | 8 — XR | 14 | [play](play:8:14) |
| Napalm (Sector Two) | 5 — Sector Two | 14 | [play](play:5:14) |
| Nuke round (“NUCLEAR SUN”) | 8 — XR | 9 | [play](play:8:9) |
| Anthrax sky | 8 — XR | 6 | [play](play:8:6) |
| Anthrax (Sector One) | 2 — Sector One | 7 | [play](play:2:7) |

---

## Enemy types

| Feature | Level | Round | Link |
|---------|-------|-------|------|
| Stealth bombers | 2 — Sector One | 10 | [play](play:2:10) |
| Fighter MG | 2 — Sector One | 1 | [play](play:2:1) |
| Apache heli | 2 — Sector One | 1 | [play](play:2:1) |
| Cheap heli | 2 — Sector One | 1 | [play](play:2:1) |
| Fighter Lizzard | 8 — XR | 1 | [play](play:8:1) |
| Parachute kamikaze | 8 — XR | 15 | [play](play:8:15) |
| Carrier | 5 — Sector Two | 1 | [play](play:5:1) |

---

## Full levels (good smoke tests)

| Level | Name | Link |
|-------|------|------|
| 1 | Training | [play from start](play:1:1) |
| 3 | Boss One | [play](play:3:1) |
| 8 | XR (weather + napalm + nukes) | [play](play:8:1) |
| 10 | Viech Chronicles | [play](play:10:1) |
| 11 | Nuke | [play](play:11:1) |
| 12 | Dragi | [play](play:12:1) |

---

## URL format

Dev links use 1-based level and round indices on the game root:

```
/?level=8&round=4&upgrades=human:5,rocket:3,rocketPower:3
/?level=8&round=4&upgrades=human:5,rocket:3,rocketPower:3&money=5000
/?level=8&round=4&upgrades=human:5,rocket:3,rocketPower:3&debug=true
```

The `play:L:R` links above are rewritten at load time to `{current host}{game path}?level=L&round=R&upgrades=human:5,rocket:3,rocketPower:3`.
