/** Vite `base` — `./` so builds work when hosted in any subdirectory. */
const BASE = import.meta.env.BASE_URL;

/** Resolve a path under `public/` for fetch, Audio, Pixi, CSS urls, etc. */
export function publicUrl(path: string): string {
  const relative = path.replace(/^\//, '');
  return `${BASE}${relative}`;
}
