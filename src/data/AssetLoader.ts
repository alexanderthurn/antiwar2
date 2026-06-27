import { Assets, type Spritesheet, Texture } from 'pixi.js';
import { publicUrl } from '../core/PublicPath';
import {
  isLooseSpriteDevEnabled,
  looseSpriteCacheToken,
  looseSpriteDevUrl,
} from './spriteDev';
import { resolveRoundVisuals } from './RoundSettings';
import type { LevelPack } from './types';

const ATLAS_DIR = 'assets/gfx/atlas';
const ATLAS_ENTRY_JSON = [`${ATLAS_DIR}/game-0.json`, `${ATLAS_DIR}/game.json`];

/** Loaded as individual files — not packed into the gameplay atlas. */
const STANDALONE_FILES = new Set([
  'assets/gfx/explosion.png',
  'assets/gfx/explosion_nuke.png',
  'assets/gfx/particle.png',
  'assets/gfx/kewlfont.png',
  'assets/gfx/menu.jpg',
  'assets/gfx/hand-cursor.png',
  'assets/gfx/nightshot.png',
]);

const STANDALONE_PREFIXES = ['assets/campaign/', 'assets/gfx/tutorial/', 'assets/gfx/3rdparty/'];

const loaded = new Set<string>();
const textureCache = new Map<string, Texture>();
const atlasFrames = new Map<string, Texture>();

let atlasLoad: Promise<void> | null = null;
let atlasAvailable = false;

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function isStandalone(path: string): boolean {
  if (STANDALONE_FILES.has(path)) return true;
  return STANDALONE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function atlasKeysForPath(path: string): string[] {
  const keys = [path, path.toLowerCase()];
  if (path.startsWith('assets/gfx/')) {
    const relative = path.slice('assets/gfx/'.length);
    keys.push(relative, relative.toLowerCase());
  }
  return keys;
}

function registerSpritesheet(sheet: Spritesheet): void {
  for (const [name, texture] of Object.entries(sheet.textures)) {
    const fullPath = name.startsWith('assets/') ? name : `assets/gfx/${name}`;
    for (const key of atlasKeysForPath(fullPath)) {
      atlasFrames.set(key, texture);
    }
  }
}

/** Primary sheet plus TexturePacker multipack siblings (game-0 + game-1, …). */
function registerSpritesheetTree(sheet: Spritesheet): void {
  registerSpritesheet(sheet);
  for (const linked of sheet.linkedSheets ?? []) {
    registerSpritesheet(linked);
  }
}

async function loadAtlasEntry(jsonPath: string): Promise<boolean> {
  const src = publicUrl(jsonPath);
  try {
    const response = await fetch(src, { method: 'HEAD' });
    if (!response.ok) return false;
  } catch {
    return false;
  }

  const sheet = await Assets.load<Spritesheet>({ alias: src, src });
  registerSpritesheetTree(sheet);
  return true;
}

/** Load packed spritesheet(s). Safe to call before gameplay textures are requested. */
export async function loadSpriteAtlas(): Promise<boolean> {
  if (atlasLoad) {
    await atlasLoad;
    return atlasAvailable;
  }

  atlasLoad = (async () => {
    for (const jsonPath of ATLAS_ENTRY_JSON) {
      if (await loadAtlasEntry(jsonPath)) {
        atlasAvailable = true;
        return;
      }
    }
  })();

  await atlasLoad;
  return atlasAvailable;
}

function lookupAtlasFrame(path: string): Texture | undefined {
  for (const key of atlasKeysForPath(path)) {
    const texture = atlasFrames.get(key);
    if (texture) return texture;
  }
  return undefined;
}

async function loadLooseDevTexture(normalized: string): Promise<Texture | null> {
  if (!isLooseSpriteDevEnabled()) return null;

  const devSrc = looseSpriteDevUrl(normalized);
  if (!devSrc) return null;

  try {
    const response = await fetch(devSrc, { method: 'HEAD' });
    if (!response.ok) return null;
  } catch {
    return null;
  }

  const epoch = looseSpriteCacheToken();
  const cacheKey = `dev-loose:${normalized}:${epoch}`;
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  await Assets.load({ alias: cacheKey, src: `${devSrc}?v=${epoch}` });
  const texture = Assets.get<Texture>(cacheKey);
  textureCache.set(cacheKey, texture);
  return texture;
}

/** Load image and return a ready texture (Pixi v8 requires Assets.load). */
export async function loadTexture(path: string): Promise<Texture> {
  const normalized = normalizePath(path);

  if (!isStandalone(normalized)) {
    const loose = await loadLooseDevTexture(normalized);
    if (loose) return loose;
  }

  const src = publicUrl(path);
  const cached = textureCache.get(src);
  if (cached) return cached;

  if (!isStandalone(normalized)) {
    await loadSpriteAtlas();
    const atlasFrame = lookupAtlasFrame(normalized);
    if (atlasFrame) {
      textureCache.set(src, atlasFrame);
      return atlasFrame;
    }
  }

  if (!loaded.has(src)) {
    await Assets.load({ alias: src, src });
    loaded.add(src);
  }
  const texture = Assets.get<Texture>(src);
  textureCache.set(src, texture);
  return texture;
}

export function collectAssetPaths(pack: LevelPack, roundIndex: number): string[] {
  const round = pack.rounds[roundIndex];
  if (!round) throw new Error(`Round ${roundIndex} missing`);

  const paths = new Set<string>();
  if (round.intro?.image) paths.add(round.intro.image);

  const cfg = pack.config.assets;
  for (const p of Object.values(cfg)) {
    if (p) paths.add(p);
  }

  const { background, ground } = resolveRoundVisuals(pack, roundIndex);
  paths.add(background);
  paths.add(ground);

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
  await loadSpriteAtlas();
  await Promise.all(collectAssetPaths(pack, roundIndex).map(loadTexture));
}
