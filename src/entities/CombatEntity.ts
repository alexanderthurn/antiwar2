import type { Sprite } from 'pixi.js';
import type { AirplaneDef, BombDef } from '../data/types';
import type { EntityMotion, EntityTraits } from './EntityTraits';

export class CombatEntity {
  private static nextId = 1;

  readonly id: number;
  readonly traits: EntityTraits;
  readonly sprite: Sprite;
  /** Source bomb template (projectiles + falling bombs). */
  readonly bombDef?: BombDef;
  /** Source airplane template (patrol units). */
  readonly airplaneDef?: AirplaneDef;

  motion: EntityMotion;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  /** Contact or explosion damage this deals. */
  damage: number;
  explosionRange = 0;
  turnRateDeg = 0;
  homingTarget: CombatEntity | null = null;
  ownerSlot = 0;
  /** Fired while crosshair was locked on a target. */
  guidedShot = false;
  alive = true;
  /** Nesting depth for splitter/submunition bombs. */
  submunitionDepth = 0;
  /** Rocket hits received (for crash-fall threshold). */
  rocketHitCount = 0;
  /** Stealth bomber — not lockable while hidden. */
  stealthHidden = false;
  stealthPhaseTimer = 0;
  /** Tumbling to ground after fatal hit (still counts for round win). */
  crashing = false;

  constructor(
    sprite: Sprite,
    traits: EntityTraits,
    motion: EntityMotion,
    stats: {
      x: number;
      y: number;
      vx?: number;
      vy?: number;
      hp: number;
      damage: number;
      explosionRange?: number;
      turnRateDeg?: number;
      bombDef?: BombDef;
      airplaneDef?: AirplaneDef;
    },
  ) {
    this.id = CombatEntity.nextId++;
    this.sprite = sprite;
    this.traits = traits;
    this.motion = motion;
    this.x = stats.x;
    this.y = stats.y;
    this.vx = stats.vx ?? 0;
    this.vy = stats.vy ?? 0;
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.damage = stats.damage;
    this.explosionRange = stats.explosionRange ?? 0;
    this.turnRateDeg = stats.turnRateDeg ?? 0;
    this.bombDef = stats.bombDef;
    this.airplaneDef = stats.airplaneDef;
    this.syncSprite();
  }

  syncSprite(): void {
    this.sprite.position.set(this.x, this.y);
    if (this.traits.isPlayerProjectile) {
      this.sprite.rotation = Math.atan2(this.vy, this.vx);
    }
  }

  steerHoming(dt: number, tickScale: number): void {
    const target = this.homingTarget;
    if (!target?.alive) return;

    const speed = Math.hypot(this.vx, this.vy);
    if (speed < 1e-6) return;

    const desired = Math.atan2(target.y - this.y, target.x - this.x);
    let current = Math.atan2(this.vy, this.vx);
    let diff = desired - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const maxTurn = (this.turnRateDeg * Math.PI / 180) * dt * tickScale;
    current += Math.max(-maxTurn, Math.min(maxTurn, diff));
    this.vx = Math.cos(current) * speed;
    this.vy = Math.sin(current) * speed;
  }
}
