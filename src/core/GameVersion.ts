/** Injected at build time from package.json (see vite.config.ts). */
export const GAME_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.13.37';

/** e.g. 0.13.37 → 1337 (major×10_000 + minor×100 + patch). */
export function encodeGameVersion(version: string): number {
  const parts = version.split('.').map((p) => parseInt(p, 10));
  const major = Number.isFinite(parts[0]) ? parts[0]! : 0;
  const minor = Number.isFinite(parts[1]) ? parts[1]! : 0;
  const patch = Number.isFinite(parts[2]) ? parts[2]! : 0;
  return major * 10_000 + minor * 100 + patch;
}

/** Inverse of {@link encodeGameVersion}, e.g. 1337 → 0.13.37. */
export function decodeGameVersion(code: number): string {
  const major = Math.floor(code / 10_000);
  const minor = Math.floor((code % 10_000) / 100);
  const patch = code % 100;
  return `${major}.${minor}.${patch}`;
}

export const GAME_VERSION_CODE = encodeGameVersion(GAME_VERSION);
