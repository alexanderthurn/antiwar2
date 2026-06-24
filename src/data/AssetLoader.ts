import { Assets, Texture } from 'pixi.js';
import { publicUrl } from '../core/PublicPath';
import type { LevelPack, RoundDef } from './types';

const loaded = new Set<string>();
const textureCache = new Map<string, Texture>();

/** Load image and return a ready texture (Pixi v8 requires Assets.load). */
export async function loadTexture(path: string): Promise<Texture> {
  const src = publicUrl(path);
  const cached = textureCache.get(src);
  if (cached) return cached;

  if (!loaded.has(src)) {
    await Assets.load({ alias: src, src });
    loaded.add(src);
  }
  const texture = Assets.get<Texture>(src);
  textureCache.set(src, texture);
  return texture;
}

export function collectAssetPaths(pack: LevelPack, round: RoundDef): string[] {
  const paths = new Set<string>();
  if (round.intro?.image) paths.add(round.intro.image);

  const cfg = pack.config.assets;
  for (const p of Object.values(cfg)) {
    if (p) paths.add(p);
  }

  for (const def of Object.values(pack.bombs)) paths.add(def.image);
  for (const spawn of round.spawns) {
    const plane = pack.airplanes[spawn.type];
    if (plane) paths.add(plane.image);
  }

  return [...paths];
}

export async function preloadRound(pack: LevelPack, roundIndex: number): Promise<void> {
  const round = pack.rounds[roundIndex];
  if (!round) throw new Error(`Round ${roundIndex} missing`);
  await Promise.all(collectAssetPaths(pack, round).map(loadTexture));
}
