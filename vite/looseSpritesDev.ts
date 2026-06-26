import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

const SPRITES_ROOT = path.resolve(process.cwd(), 'textures-pack/sprites');
const DEV_ROUTE = '/dev/sprites';

/** Case-insensitive resolve under sprites root; blocks path traversal. */
export function resolveLooseSpriteFile(urlPath: string): string | null {
  const clean = urlPath.replace(/\\/g, '/').replace(/^\//, '');
  if (!clean || clean.includes('..')) return null;

  const segments = clean.split('/');
  let dir = SPRITES_ROOT;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    if (!segment || segment === '.') continue;

    if (i === segments.length - 1) {
      if (!fs.existsSync(dir)) return null;
      const match = fs.readdirSync(dir).find((name) => name.toLowerCase() === segment.toLowerCase());
      return match ? path.join(dir, match) : null;
    }

    if (!fs.existsSync(dir)) return null;
    const match = fs.readdirSync(dir, { withFileTypes: true })
      .find((entry) => entry.isDirectory() && entry.name.toLowerCase() === segment.toLowerCase());
    if (!match) return null;
    dir = path.join(dir, match.name);
  }

  return null;
}

function contentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

function relativeSpritePath(absolutePath: string): string | null {
  const rel = path.relative(SPRITES_ROOT, absolutePath).replace(/\\/g, '/');
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel;
}

function attachWatcher(server: ViteDevServer): void {
  server.watcher.add(SPRITES_ROOT);
  server.watcher.on('add', (file) => notifySpriteChange(server, file));
  server.watcher.on('change', (file) => notifySpriteChange(server, file));
  server.watcher.on('unlink', (file) => notifySpriteChange(server, file));
}

function notifySpriteChange(server: ViteDevServer, file: string): void {
  const abs = path.resolve(file);
  if (!abs.startsWith(SPRITES_ROOT)) return;
  const relative = relativeSpritePath(abs);
  if (!relative) return;

  server.ws.send({
    type: 'custom',
    event: 'loose-sprite-update',
    data: { relative },
  });
}

/** Dev-only: serve textures-pack/sprites as loose files for live art iteration. */
export function looseSpritesDevPlugin(): Plugin {
  return {
    name: 'loose-sprites-dev',
    apply: 'serve',
    configureServer(server) {
      if (process.env.VITE_LOOSE_SPRITES !== 'true') return;

      server.middlewares.use(DEV_ROUTE, (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          next();
          return;
        }

        const urlPath = decodeURIComponent(req.url ?? '').split('?')[0] ?? '';
        const filePath = resolveLooseSpriteFile(urlPath);
        if (!filePath || !fs.existsSync(filePath)) {
          next();
          return;
        }

        const stat = fs.statSync(filePath);
        res.setHeader('Content-Type', contentType(filePath));
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Last-Modified', stat.mtime.toUTCString());

        if (req.method === 'HEAD') {
          res.statusCode = 200;
          res.end();
          return;
        }

        fs.createReadStream(filePath).pipe(res);
      });

      attachWatcher(server);
    },
  };
}

export { DEV_ROUTE as LOOSE_SPRITES_DEV_ROUTE };
