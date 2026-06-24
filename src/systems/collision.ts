import type { Sprite } from 'pixi.js';

type Box = { minX: number; minY: number; maxX: number; maxY: number };
type Point2 = [number, number];

/** Max distance a rocket travels per collision sub-step (design px). */
const MIN_SWEEP_STEP = 2;
const MAX_SWEEP_STEP = 6;

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

function boxFromCorners(corners: Point2[], pad = 0): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of corners) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}

function spriteBox(sprite: Sprite, pad = 0): Box {
  const corners = spriteCorners(sprite);
  if (!corners.length) {
    return { minX: sprite.x - pad, minY: sprite.y - pad, maxX: sprite.x + pad, maxY: sprite.y + pad };
  }
  return boxFromCorners(corners, pad);
}

function pointInBox(x: number, y: number, box: Box): boolean {
  return x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY;
}

function aabbOverlap(a: Box, b: Box): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
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

function obbOverlap(a: Sprite, b: Sprite): boolean {
  const ac = spriteCorners(a);
  const bc = spriteCorners(b);
  if (ac.length < 4 || bc.length < 4) return false;
  if (!aabbOverlap(boxFromCorners(ac), boxFromCorners(bc))) return false;
  return satOverlap(ac, bc);
}

/** Exact segment vs axis-aligned box (slab method). */
function segmentIntersectsBox(x0: number, y0: number, x1: number, y1: number, box: Box): boolean {
  if (pointInBox(x0, y0, box) || pointInBox(x1, y1, box)) return true;

  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;

  const axes = [
    { p: x0, dp: dx, min: box.minX, max: box.maxX },
    { p: y0, dp: dy, min: box.minY, max: box.maxY },
  ];

  for (const { p, dp, min, max } of axes) {
    if (Math.abs(dp) < 1e-9) {
      if (p < min || p > max) return false;
      continue;
    }
    let tNear = (min - p) / dp;
    let tFar = (max - p) / dp;
    if (tNear > tFar) [tNear, tFar] = [tFar, tNear];
    t0 = Math.max(t0, tNear);
    t1 = Math.min(t1, tFar);
    if (t0 > t1) return false;
  }
  return true;
}

/** How far to step along a rocket path per sample (half the shorter sprite side). */
export function rocketSweepStep(rocket: Sprite): number {
  const w = rocket.width;
  const h = rocket.height;
  const minDim = w > 0 && h > 0 ? Math.min(w, h) : 6;
  return Math.max(MIN_SWEEP_STEP, Math.min(MAX_SWEEP_STEP, minDim * 0.5));
}

/** Whether a design-space point lies inside a sprite's padded hit box. */
export function pointHitsSprite(sprite: Sprite, x: number, y: number, pad = 10): boolean {
  return pointInBox(x, y, spriteBox(sprite, pad));
}

/** Rotated sprite rects overlap in design space. */
export function spritesOverlap(a: Sprite, b: Sprite, padA = 0, padB = 0): boolean {
  if (padA === 0 && padB === 0) return obbOverlap(a, b);
  return aabbOverlap(spriteBox(a, padA), spriteBox(b, padB));
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
  target: Sprite,
  x: number,
  y: number,
  saved: { x: number; y: number },
): boolean {
  rocketAt(rocket, x, y, saved);
  const hit = obbOverlap(rocket, target);
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

  const targetBox = spriteBox(target, 16);
  const rocketPad = Math.max(rocket.width, rocket.height) * 0.5;
  const sweptBox: Box = {
    minX: Math.min(prevX, curX) - rocketPad,
    minY: Math.min(prevY, curY) - rocketPad,
    maxX: Math.max(prevX, curX) + rocketPad,
    maxY: Math.max(prevY, curY) + rocketPad,
  };

  if (!aabbOverlap(sweptBox, targetBox)) {
    return false;
  }

  if (rocketOverlapsTargetAt(rocket, target, curX, curY, saved)) return true;
  if (segmentIntersectsBox(prevX, prevY, curX, curY, targetBox)) return true;

  const step = rocketSweepStep(rocket);
  const samples = Math.max(1, Math.ceil(travel / step));
  for (let i = 0; i <= samples; i++) {
    const t = samples === 0 ? 1 : i / samples;
    const x = prevX + dx * t;
    const y = prevY + dy * t;
    if (rocketOverlapsTargetAt(rocket, target, x, y, saved)) return true;
  }

  return false;
}
