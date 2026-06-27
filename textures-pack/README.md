# Sprite atlas source (TexturePacker)

Loose gameplay/UI sprites live here. **Do not** put them in `public/` — pack them into `public/assets/gfx/atlas/` instead.

## Designer art mode (no atlas repack)

For live sprite iteration, run:

```bash
npm run art
```

This loads sprites **directly from `textures-pack/sprites/`** instead of the packed atlas. Your designer can:

1. Edit or replace a PNG in `textures-pack/sprites/` (e.g. `AIRPLANES/bomber.png`)
2. Save the file
3. The browser reloads automatically and shows the new art

Normal `npm run dev` always uses the packed atlas — same as production.

| Command | Sprites from |
|---------|----------------|
| `npm run dev` | `public/assets/gfx/atlas/` (packed) |
| `npm run art` | `textures-pack/sprites/` (loose, live reload) |

Production builds always use the packed atlas.

## What stays outside the atlas

These remain as individual files in `public/assets/gfx/`:

| Path | Reason |
|------|--------|
| `assets/campaign/` | Campaign maps, thumbs, backgrounds, intro art, human walk-cycle |
| `assets/gfx/tutorial/` | Full-screen tutorial images |
| `assets/gfx/explosion.png`, `explosion_nuke.png` | Animated FX sheets (custom slicing) |
| `assets/gfx/particle.png` | Particle grid sheet (custom slicing) |
| `assets/gfx/kewlfont.png` | Bitmap font |
| `assets/gfx/menu.jpg` | Full-screen menu background |
| `assets/gfx/hand-cursor.png` | CSS `cursor: url(...)` — must be a real file URL |
| `assets/gfx/nightshot.png` | Large night-vision overlay — kept as a single full texture |

Campaign loose art and level JSON live under `public/assets/campaign/<id>/` (not packed). Thumbs, viech intros, backgrounds, maps, and `N.json` level packs sit beside each other.

Everything else under `textures-pack/sprites/` should be packed for release.

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

### Day-to-day (designer)

1. Run `npm run art`
2. Edit sprites in `textures-pack/sprites/`
3. Save — browser auto-reloads

### Day-to-day (code / gameplay)

1. Run `npm run dev` (uses packed atlas)

### Release

1. Publish from TexturePacker (Cmd+P / Publish sprite sheet)
2. Commit the updated files in `public/assets/gfx/atlas/`
3. Build / ship — production uses the atlas

## Folder layout

```
textures-pack/
  README.md
  sprites/
    AIRPLANES/
    BOMBS/
    buttons/
    buttons_map/
    3rdparty/
    tower.png
    cannon.png
    …
```

Campaign thumbs, viech intros, backgrounds, maps, and JSON: `public/assets/campaign/<id>/` (loose, not packed).
