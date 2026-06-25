/** v1 ground strip height in pixels @ 768p */
const V1_GROUND_HEIGHT = 50;

export const DESIGN = {
  width: 1920,
  height: 1080,
  groundHeight: V1_GROUND_HEIGHT * (1080 / 768),
  /** Top edge of the ground HUD strip — units stand here (dune line in background). */
  groundY: 1080 - V1_GROUND_HEIGHT * (1080 / 768),
} as const;

/** Extra crosshair lift above the finger on touch, in physical centimeters. */
export const TOUCH_AIM_EXTRA_CM = 1;

/** Effects and physics stop at this Y (top of ground strip). */
export const GROUND_SURFACE_Y = DESIGN.groundY;
export const TOWER = {
  baseLeft: 60,
  baseRight: 1860,
  insetPerPlayer: 160,
} as const;

/** Measured from v1 tower.png / cannon.png (1024-era art, 1:1 px in game) */
export const V1_SPRITES = {
  /** Y offset from tower foot to pivot between the two station poles */
  towerMountFromBottom: 52,
  /** cannon.png pivot at bitmap center (sits on tower center) */
  cannonPivot: { x: 0.5, y: 0.5 },
  /** Spawn rockets slightly ahead of the cannon pivot along barrel aim */
  cannonMuzzle: 18,
} as const;

export function towerMountY(footY = DESIGN.groundY): number {
  return footY - V1_SPRITES.towerMountFromBottom;
}

export const PLAYER_COLORS = [
  0x44aaff,
  0xff6644,
  0x44ff88,
  0xffaa44,
  0xcc66ff,
] as const;

export function towerXForSlot(slot: number): { left: number; right: number } {
  const inset = slot * TOWER.insetPerPlayer;
  return {
    left: TOWER.baseLeft + inset,
    right: TOWER.baseRight - inset,
  };
}

export function scaleCoord(x: number, y: number): { x: number; y: number } {
  return {
    x: x * (DESIGN.width / 1024),
    y: y * (DESIGN.height / 768),
  };
}

/** Scale a v1 (768p) Y coordinate into current design space. */
export function scaleV1Y(y: number): number {
  return y * (DESIGN.height / 768);
}
