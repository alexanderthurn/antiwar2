# Sprite atlas source (TexturePacker)

Loose gameplay/UI sprites live here. **Do not** put them in `public/` — pack them into `public/assets/gfx/atlas/` instead.

## What stays outside the atlas

These remain as individual files in `public/assets/gfx/`:

| Path | Reason |
|------|--------|
| `backgrounds/` | Full-screen JPG/PNG backdrops |
| `tutorial/` | Full-screen tutorial images |
| `human.png` | Walk-cycle sheet (custom frame slicing in code) |
| `explosion.png`, `explosion_nuke.png` | Animated FX sheets (custom slicing) |
| `particle.png` | Particle grid sheet (custom slicing) |
| `kewlfont.png` | Bitmap font |
| `menu.jpg` | Full-screen menu background |
| `map.png` | Full-screen campaign map |
| `hand-cursor.png` | CSS `cursor: url(...)` — must be a real file URL |
| `nightshot.png` | Large night-vision overlay — kept as a single full texture |

Everything else under `sprites/` should be packed.

## TexturePacker settings

| Setting | Value |
|---------|-------|
| **Data format** | PixiJS |
| **Texture format** | PNG (32 bit, alpha) |
| **Input** | `textures-pack/sprites/` (this folder's `sprites` subfolder) |
| **Output data file** | `public/assets/gfx/atlas/game.json` |
| **Output texture file** | `public/assets/gfx/atlas/game.png` |
| **Multipack** | On |
| **Max size** | 2048 × 2048 |
| **Scale** | 1 (no @2x variant) |
| **Trim sprites** | On (default) |
| **Allow rotation** | On (saves space) |

### Sprite naming (important)

Enable **prepend folder name** (or equivalent) so frame names include subfolders, e.g.:

- `BOMBS/bomb.png`
- `AIRPLANES/bomber.png`
- `buttons/button_go.png`

The game resolves `assets/gfx/BOMBS/bomb.png` → atlas frame `BOMBS/bomb.png`.

### Multipack output

With multipack enabled, TexturePacker writes `game-0.json` + `game-0.png`, `game-1.json` + `game-1.png`, etc. **Only load the first sheet** (`game-0.json`) — Pixi follows `related_multi_packs` and loads the rest automatically. `AssetLoader` registers frames from all linked sheets.

If you disable multipack, a single `game.json` + `game.png` also works.

## Workflow

1. Edit sprites in `textures-pack/sprites/`
2. Publish from TexturePacker (Cmd+P / Publish sprite sheet)
3. Commit the updated files in `public/assets/gfx/atlas/`
4. Reload the game — no code or JSON changes needed

## Folder layout

```
textures-pack/
  README.md
  sprites/
    AIRPLANES/
    BOMBS/
    buttons/
    buttons_map/
    thumbs/
    viech/
    3rdparty/
    tower.png
    cannon.png
    …
```
