/** Property flags — behavior comes from traits, not entity subclass. */
export interface EntityTraits {
  /** Crosshair can lock onto this. */
  lockOnTarget: boolean;
  /** Guided projectiles steer toward this. */
  homingTarget: boolean;
  /** Player rockets can collide with and damage this. */
  hittableByPlayer: boolean;
  /** Ground impact/explosion damages civilians. */
  hurtsHumansOnGround: boolean;
  /** Death or ground hit spawns an explosion. */
  explodesOnDeath: boolean;
  /** Screen shake style when this dies. */
  deathRumble: 'plane' | 'explosion' | 'none';
  /** Despawn when leaving the playfield sides/top/bottom. */
  checkOutOfScreen: boolean;
  /** Must be destroyed for the round to end. */
  countsForRoundWin: boolean;
  /** Fired from a player turret (rocket). */
  isPlayerProjectile: boolean;
}

export type MotionKind = 'projectile' | 'fall' | 'patrol';

export interface PatrolMotion {
  kind: 'patrol';
  ai: string;
  dir: 1 | -1;
  targetY: number;
  bombTimer: number;
  phase: number;
  phaseT: number;
  altChanges: number;
  spawnIndex: number;
  isEndmaster: boolean;
}

export interface FallMotion {
  kind: 'fall';
  /** Shot-down plane tumbling to the ground. */
  crashPlane?: boolean;
  vx?: number;
  spin?: number;
}

export interface ProjectileMotion {
  kind: 'projectile';
}

export type EntityMotion = PatrolMotion | FallMotion | ProjectileMotion;
