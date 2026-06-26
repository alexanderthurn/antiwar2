import { Container, Graphics, type Sprite } from 'pixi.js';
import type { CombatEntity } from '../entities/CombatEntity';
import { pointHitsSprite } from '../systems/collision';

const HIT_FLASH_SEC = 0.5;
const HOVER_PAD = 28;
/** When sprite top is above this Y, draw the HP bar below instead of above. */
const BAR_FLIP_TOP_Y = 200;

export interface HpBarCivilian {
  id: number;
  alive: boolean;
  hp: number;
  maxHp: number;
  sprite: Sprite;
}

function hpColor(ratio: number): number {
  if (ratio > 0.6) return 0x55dd55;
  if (ratio > 0.3) return 0xdddd44;
  return 0xee5533;
}

/** Small per-unit HP bars — flash on damage, show while cursor is near. */
export class EntityHpBarOverlay extends Container {
  private gfx = new Graphics();
  private entityHitTimers = new Map<number, number>();
  private civilianHitTimers = new Map<number, number>();

  constructor() {
    super();
    this.addChild(this.gfx);
  }

  notifyHit(entity: CombatEntity): void {
    if (!entity.alive || !entity.traits.hittableByPlayer) return;
    this.entityHitTimers.set(entity.id, HIT_FLASH_SEC);
  }

  notifyCivilianHit(civilian: HpBarCivilian): void {
    if (!civilian.alive || civilian.maxHp <= 0) return;
    this.civilianHitTimers.set(civilian.id, HIT_FLASH_SEC);
  }

  clear(): void {
    this.entityHitTimers.clear();
    this.civilianHitTimers.clear();
    this.gfx.clear();
  }

  update(
    dt: number,
    entities: CombatEntity[],
    civilians: HpBarCivilian[],
    aimPoints: { x: number; y: number }[],
  ): void {
    this.tickTimers(dt, this.entityHitTimers, entities.map((e) => e.id));
    this.tickTimers(dt, this.civilianHitTimers, civilians.map((c) => c.id));

    this.gfx.clear();

    for (const entity of entities) {
      if (!entity.alive || !entity.traits.hittableByPlayer || entity.maxHp <= 0) continue;

      const hitFlash = this.entityHitTimers.get(entity.id) ?? 0;
      const hovered = aimPoints.some(({ x, y }) =>
        pointHitsSprite(entity.sprite, x, y, HOVER_PAD),
      );
      if (hitFlash <= 0 && !hovered) continue;

      this.drawBar(entity.sprite, entity.hp, entity.maxHp, hitFlash);
    }

    for (const civilian of civilians) {
      if (!civilian.alive || civilian.maxHp <= 0) continue;

      const hitFlash = this.civilianHitTimers.get(civilian.id) ?? 0;
      const hovered = aimPoints.some(({ x, y }) =>
        pointHitsSprite(civilian.sprite, x, y, HOVER_PAD),
      );
      if (hitFlash <= 0 && !hovered) continue;

      this.drawBar(civilian.sprite, civilian.hp, civilian.maxHp, hitFlash);
    }
  }

  private tickTimers(dt: number, timers: Map<number, number>, livingIds: number[]): void {
    const living = new Set(livingIds);
    for (const [id, timeLeft] of timers) {
      if (!living.has(id)) {
        timers.delete(id);
        continue;
      }
      const next = timeLeft - dt;
      if (next <= 0) timers.delete(id);
      else timers.set(id, next);
    }
  }

  private drawBar(sprite: Sprite, hp: number, maxHp: number, hitFlash: number): void {
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    const w = Math.max(1, sprite.width);
    const h = 6;
    const gap = 4;
    const x = sprite.x - w / 2;
    const topY = sprite.y - sprite.height * sprite.anchor.y;
    const bottomY = sprite.y + sprite.height * (1 - sprite.anchor.y);
    const aboveY = topY - h - gap;
    const y = topY < BAR_FLIP_TOP_Y ? bottomY + gap : aboveY;
    const pulse = hitFlash > 0 ? 0.65 + 0.35 * Math.min(1, hitFlash / 0.25) : 1;

    this.gfx.roundRect(x, y, w, h, 2).fill({ color: 0x000000, alpha: 0.6 * pulse });
    this.gfx.roundRect(x, y, w, h, 2).stroke({ color: 0xffffff, width: 1, alpha: 0.35 * pulse });
    if (ratio > 0) {
      this.gfx
        .roundRect(x + 1, y + 1, Math.max(1, (w - 2) * ratio), h - 2, 1)
        .fill({ color: hpColor(ratio), alpha: 0.95 * pulse });
    }
  }
}
