import { publicUrl } from '../core/PublicPath';

/** Must match vite/looseSpritesDev.ts */
const LOOSE_SPRITES_DEV_ROUTE = '/dev/sprites';

/** Loose sprite overrides — dev only, when VITE_LOOSE_SPRITES=true (e.g. npm run art). */
export function isLooseSpriteDevEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_LOOSE_SPRITES === 'true';
}

/** `assets/gfx/BOMBS/bomb.png` → `BOMBS/bomb.png` under textures-pack/sprites. */
export function looseSpriteRelativePath(gamePath: string): string | null {
  const normalized = gamePath.replace(/\\/g, '/');
  if (!normalized.startsWith('assets/gfx/')) return null;
  return normalized.slice('assets/gfx/'.length);
}

export function looseSpriteDevUrl(gamePath: string): string | null {
  const relative = looseSpriteRelativePath(gamePath);
  if (!relative) return null;
  return publicUrl(`${LOOSE_SPRITES_DEV_ROUTE}/${relative}`);
}

let looseSpriteEpoch = 0;

/** Bumped when textures-pack/sprites changes; busts Pixi texture cache in dev. */
export function bumpLooseSpriteEpoch(): void {
  looseSpriteEpoch++;
}

export function looseSpriteCacheToken(): number {
  return looseSpriteEpoch;
}

if (import.meta.hot) {
  import.meta.hot.on('loose-sprite-update', () => {
    bumpLooseSpriteEpoch();
    location.reload();
  });
}
