import type { Sprite } from 'pixi.js';
import { getCollisionShape } from '../data/CollisionShapes';

export type Box = { minX: number; minY: number; maxX: number; maxY: number };
type Point2 = [number, number];

/** Narrow-phase data (world polygons / OBB). Built only after broad-phase passes. */
export interface CollisionBody {
  polygons: Point2[][];
  obb: Point2[];
}

/** Max distance a rocket travels per collision sub-step (design px). */
const MIN_SWEEP_STEP = 2;
const MAX_SWEEP_STEP = 6;

const spriteImagePath = new WeakMap<Sprite, string>();

/** Precomputed at bind: conservative radius in design px (rotation-invariant broad phase). */
interface BroadPhaseMeta {
  broadRadius: number;
}

const broadPhaseMeta = new WeakMap<Sprite, BroadPhaseMeta>();

interface BodyCacheEntry {
  frame: number;
  signature: string;
  body: CollisionBody;
}

let collisionFrame = 0;
const bodyCache = new WeakMap<Sprite, BodyCacheEntry>();

/** Call once per simulation step before collision queries (clears per-frame narrow-phase cache). */
export function beginCollisionFrame(): void {
  collisionFrame++;
}

function maxScaleFromDef(scale?: [number, number]): number {
  if (!scale) return 1;
  return Math.max(Math.abs(scale[0]), Math.abs(scale[1]));
}

/** Furthest source-pixel distance from anchor — rotation-invariant broad-phase radius at maxScale. */
function broadRadiusForShape(
  origW: number,
  origH: number,
  imagePath: string,
  anchorX: number,
  anchorY: number,
  maxScale: number,
): number {
  const pivotX = anchorX * origW;
  const pivotY = anchorY * origH;
  const shape = getCollisionShape(imagePath);

  if (shape?.length) {
    let maxR = 0;
    for (const poly of shape) {
      for (const v of poly) {
        maxR = Math.max(maxR, Math.hypot(v.x - pivotX, v.y - pivotY));
      }
    }
    return maxR * maxScale;
  }

  const hw = origW * Math.max(anchorX, 1 - anchorX);
  const hh = origH * Math.max(anchorY, 1 - anchorY);
  return Math.hypot(hw, hh) * maxScale;
}

/**
 * Link sprite to collision data. Broad-phase radius is fixed at bind using campaign
 * scale (use the largest scale the sprite will ever use).
 */
export function bindSpriteCollisionPath(
  sprite: Sprite,
  imagePath: string,
  scale?: [number, number],
): void {
  spriteImagePath.set(sprite, imagePath);
  const origW = sprite.texture.orig.width;
  const origH = sprite.texture.orig.height;
  const maxScale = maxScaleFromDef(scale);
  broadPhaseMeta.set(sprite, {
    broadRadius: broadRadiusForShape(
      origW,
      origH,
      imagePath,
      sprite.anchor.x,
      sprite.anchor.y,
      maxScale,
    ),
  });
}

function fallbackBroadRadius(sprite: Sprite): number {
  const w = sprite.width;
  const h = sprite.height;
  if (w <= 0 || h <= 0) return 1;
  return Math.hypot(w * 0.5, h * 0.5);
}

/** World-space AABB for broad phase — position only, size from bind-time radius. */
export function getBroadPhaseBounds(sprite: Sprite, pad = 0): Box {
  const meta = broadPhaseMeta.get(sprite);
  const r = (meta?.broadRadius ?? fallbackBroadRadius(sprite)) + pad;
  return {
    minX: sprite.x - r,
    minY: sprite.y - r,
    maxX: sprite.x + r,
    maxY: sprite.y + r,
  };
}

export function expandBox(box: Box, pad: number): Box {
  if (pad <= 0) return box;
  return {
    minX: box.minX - pad,
    minY: box.minY - pad,
    maxX: box.maxX + pad,
    maxY: box.maxY + pad,
  };
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

export function pointInBox(x: number, y: number, box: Box): boolean {
  return x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY;
}

/** Axis-aligned bounds of a rocket path segment (broad phase for projectile vs target). */
export function projectileSweptBounds(
  sprite: Sprite,
  prevX: number,
  prevY: number,
  curX = sprite.x,
  curY = sprite.y,
): Box {
  const meta = broadPhaseMeta.get(sprite);
  const rocketPad = meta?.broadRadius ?? fallbackBroadRadius(sprite);
  return {
    minX: Math.min(prevX, curX) - rocketPad,
    minY: Math.min(prevY, curY) - rocketPad,
    maxX: Math.max(prevX, curX) + rocketPad,
    maxY: Math.max(prevY, curY) + rocketPad,
  };
}

function spriteSignature(sprite: Sprite): string {
  return `${sprite.x}|${sprite.y}|${sprite.rotation}|${sprite.scale.x}|${sprite.scale.y}`;
}

/** Oriented sprite corners in parent/design space (anchor + rotation + flip). */
function spriteCorners(sprite: Sprite): Point2[] {
  const w = sprite.width;
  const h = sprite.height;
  if (w <= 0 || h <= 0) return [];

  let rot = sprite.rotation;
  if (sprite.scale.x < 0) rot += Math.PI;

  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const ox = (0.5 - sprite.anchor.x) * w;
  const oy = (0.5 - sprite.anchor.y) * h;
  const cx = sprite.x + ox * cos - oy * sin;
  const cy = sprite.y + ox * sin + oy * cos;
  const hw = w / 2;
  const hh = h / 2;

  return [
    [cx - hw * cos + hh * sin, cy - hw * sin - hh * cos],
    [cx + hw * cos + hh * sin, cy + hw * sin - hh * cos],
    [cx + hw * cos - hh * sin, cy + hw * sin + hh * cos],
    [cx - hw * cos - hh * sin, cy - hw * sin + hh * cos],
  ];
}

/** Map a PhysicsEditor vertex (source image px) to design-space world coordinates. */
function sourceVertexToWorld(sprite: Sprite, vx: number, vy: number): Point2 {
  const origW = sprite.texture.orig.width;
  const origH = sprite.texture.orig.height;
  const w = sprite.width;
  const h = sprite.height;

  const lx = (vx / origW - sprite.anchor.x) * w;
  const ly = (vy / origH - sprite.anchor.y) * h;

  let rot = sprite.rotation;
  if (sprite.scale.x < 0) rot += Math.PI;

  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const ox = (0.5 - sprite.anchor.x) * w;
  const oy = (0.5 - sprite.anchor.y) * h;
  const cx = sprite.x + ox * cos - oy * sin;
  const cy = sprite.y + ox * sin + oy * cos;

  return [cx + lx * cos - ly * sin, cy + lx * sin + ly * cos];
}

function buildWorldPolygons(sprite: Sprite): Point2[][] {
  const path = spriteImagePath.get(sprite);
  if (!path) return [];
  const shape = getCollisionShape(path);
  if (!shape?.length) return [];
  return shape.map((poly) => poly.map((v) => sourceVertexToWorld(sprite, v.x, v.y)));
}

function buildCollisionBody(sprite: Sprite): CollisionBody {
  const polygons = buildWorldPolygons(sprite);
  const obb = spriteCorners(sprite);
  return { polygons, obb };
}

export function getCollisionBody(sprite: Sprite): CollisionBody {
  const signature = spriteSignature(sprite);
  const cached = bodyCache.get(sprite);
  if (cached && cached.frame === collisionFrame && cached.signature === signature) {
    return cached.body;
  }
  const body = buildCollisionBody(sprite);
  bodyCache.set(sprite, { frame: collisionFrame, signature, body });
  return body;
}

function projectCorners(corners: Point2[], ax: number, ay: number): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const [x, y] of corners) {
    const p = x * ax + y * ay;
    min = Math.min(min, p);
    max = Math.max(max, p);
  }
  return [min, max];
}

function satOverlap(a: Point2[], b: Point2[]): boolean {
  const axes: Point2[] = [];
  for (let i = 0; i < a.length; i++) {
    const [x1, y1] = a[i]!;
    const [x2, y2] = a[(i + 1) % a.length]!;
    const ex = x2 - x1;
    const ey = y2 - y1;
    const len = Math.hypot(ex, ey);
    if (len < 1e-6) continue;
    axes.push([-ey / len, ex / len]);
  }
  for (let i = 0; i < b.length; i++) {
    const [x1, y1] = b[i]!;
    const [x2, y2] = b[(i + 1) % b.length]!;
    const ex = x2 - x1;
    const ey = y2 - y1;
    const len = Math.hypot(ex, ey);
    if (len < 1e-6) continue;
    axes.push([-ey / len, ex / len]);
  }

  for (const [ax, ay] of axes) {
    const [aMin, aMax] = projectCorners(a, ax, ay);
    const [bMin, bMax] = projectCorners(b, ax, ay);
    if (aMax < bMin || bMax < aMin) return false;
  }
  return true;
}

function pointInPolygon(x: number, y: number, poly: Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function minDistToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function minDistToPolygon(px: number, py: number, poly: Point2[]): number {
  let min = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]!;
    const [x2, y2] = poly[(i + 1) % poly.length]!;
    min = Math.min(min, minDistToSegment(px, py, x1, y1, x2, y2));
  }
  return min;
}

function polygonsOverlap(a: Point2[][], b: Point2[][]): boolean {
  for (const ap of a) {
    for (const bp of b) {
      if (satOverlap(ap, bp)) return true;
    }
  }
  return false;
}

function bodiesNarrowOverlap(a: CollisionBody, b: CollisionBody): boolean {
  if (a.polygons.length || b.polygons.length) {
    if (a.polygons.length && b.polygons.length) return polygonsOverlap(a.polygons, b.polygons);

    const aTests = a.polygons.length ? a.polygons : [a.obb];
    const bTests = b.polygons.length ? b.polygons : [b.obb];
    for (const ap of aTests) {
      if (ap.length < 3) continue;
      for (const bp of bTests) {
        if (bp.length < 3) continue;
        if (satOverlap(ap, bp)) return true;
      }
    }
    return false;
  }

  if (a.obb.length < 4 || b.obb.length < 4) return false;
  return satOverlap(a.obb, b.obb);
}

/** How far to step along a rocket path per sample (half the shorter sprite side). */
export function rocketSweepStep(rocket: Sprite): number {
  const meta = broadPhaseMeta.get(rocket);
  if (meta) return Math.max(MIN_SWEEP_STEP, Math.min(MAX_SWEEP_STEP, meta.broadRadius * 0.5));
  const w = rocket.width;
  const h = rocket.height;
  const minDim = w > 0 && h > 0 ? Math.min(w, h) : 6;
  return Math.max(MIN_SWEEP_STEP, Math.min(MAX_SWEEP_STEP, minDim * 0.5));
}

function pointHitsBody(body: CollisionBody, x: number, y: number, pad = 10): boolean {
  if (body.polygons.length) {
    for (const poly of body.polygons) {
      if (pointInPolygon(x, y, poly)) return true;
      if (pad > 0 && minDistToPolygon(x, y, poly) <= pad) return true;
    }
    return false;
  }

  if (body.obb.length >= 4) {
    return pointInPolygon(x, y, body.obb);
  }
  return false;
}

/** Whether a design-space point lies inside a sprite's padded hit box. */
export function pointHitsSprite(sprite: Sprite, x: number, y: number, pad = 10): boolean {
  if (!pointInBox(x, y, getBroadPhaseBounds(sprite, pad))) return false;
  return pointHitsBody(getCollisionBody(sprite), x, y, pad);
}

/** Rotated sprite rects overlap in design space. */
export function spritesOverlap(a: Sprite, b: Sprite, padA = 0, padB = 0): boolean {
  if (!boxesOverlap(getBroadPhaseBounds(a, padA), getBroadPhaseBounds(b, padB))) return false;
  if (padA === 0 && padB === 0) return bodiesNarrowOverlap(getCollisionBody(a), getCollisionBody(b));
  return true;
}

function rocketAt(rocket: Sprite, x: number, y: number, saved: { x: number; y: number }): void {
  saved.x = rocket.x;
  saved.y = rocket.y;
  rocket.position.set(x, y);
}

function restoreRocket(rocket: Sprite, saved: { x: number; y: number }): void {
  rocket.position.set(saved.x, saved.y);
}

function rocketOverlapsTargetAt(
  rocket: Sprite,
  x: number,
  y: number,
  saved: { x: number; y: number },
  targetBody: CollisionBody,
): boolean {
  rocketAt(rocket, x, y, saved);
  const hit = bodiesNarrowOverlap(getCollisionBody(rocket), targetBody);
  restoreRocket(rocket, saved);
  return hit;
}

/**
 * Swept rocket vs target. Samples along prev→current so fast/thin rockets
 * cannot tunnel through targets between frames (v1-style fix).
 */
export function rocketHitsSprite(
  rocket: Sprite,
  target: Sprite,
  prevX: number,
  prevY: number,
): boolean {
  const curX = rocket.x;
  const curY = rocket.y;
  const dx = curX - prevX;
  const dy = curY - prevY;
  const travel = Math.hypot(dx, dy);
  const saved = { x: curX, y: curY };

  const targetBox = getBroadPhaseBounds(target, 16);
  const sweptBox = projectileSweptBounds(rocket, prevX, prevY, curX, curY);

  if (!boxesOverlap(sweptBox, targetBox)) {
    return false;
  }

  const targetBody = getCollisionBody(target);

  if (rocketOverlapsTargetAt(rocket, curX, curY, saved, targetBody)) return true;

  const step = rocketSweepStep(rocket);
  const samples = Math.max(1, Math.ceil(travel / step));
  for (let i = 0; i <= samples; i++) {
    const t = samples === 0 ? 1 : i / samples;
    const x = prevX + dx * t;
    const y = prevY + dy * t;
    if (rocketOverlapsTargetAt(rocket, x, y, saved, targetBody)) return true;
  }

  return false;
}
