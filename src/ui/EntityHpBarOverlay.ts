import { Container, Graphics } from 'pixi.js';
import type { CombatEntity } from '../entities/CombatEntity';
import { pointHitsSprite } from '../systems/collision';

const HIT_FLASH_SEC = 0.5;
const HOVER_PAD = 28;

function hpColor(ratio: number): number {
  if (ratio > 0.6) return 0x55dd55;
  if (ratio > 0.3) return 0xdddd44;
  return 0xee5533;
}

/** Small per-unit HP bars — flash on damage, show while cursor is near. */
export class EntityHpBarOverlay extends Container {
  private gfx = new Graphics();
  private hitTimers = new Map<number, number>();

  constructor() {
    super();
    this.addChild(this.gfx);
  }

  notifyHit(entity: CombatEntity): void {
    if (!entity.alive || !entity.traits.hittableByPlayer) return;
    this.hitTimers.set(entity.id, HIT_FLASH_SEC);
  }

  clear(): void {
    this.hitTimers.clear();
    this.gfx.clear();
  }

  update(
    dt: number,
    entities: CombatEntity[],
    aimPoints: { x: number; y: number }[],
  ): void {
    const livingIds = new Set<number>();
    for (const entity of entities) livingIds.add(entity.id);

    for (const [id, timeLeft] of this.hitTimers) {
      if (!livingIds.has(id)) {
        this.hitTimers.delete(id);
        continue;
      }
      const next = timeLeft - dt;
      if (next <= 0) this.hitTimers.delete(id);
      else this.hitTimers.set(id, next);
    }

    this.gfx.clear();

    for (const entity of entities) {
      if (!entity.alive || !entity.traits.hittableByPlayer || entity.maxHp <= 0) continue;

      const hitFlash = this.hitTimers.get(entity.id) ?? 0;
      const hovered = aimPoints.some(({ x, y }) =>
        pointHitsSprite(entity.sprite, x, y, HOVER_PAD),
      );
      if (hitFlash <= 0 && !hovered) continue;

      this.drawBar(entity, hitFlash);
    }
  }

  private drawBar(entity: CombatEntity, hitFlash: number): void {
    const ratio = Math.max(0, Math.min(1, entity.hp / entity.maxHp));
    const w = Math.max(1, entity.sprite.width);
    const h = 6;
    const x = entity.x - w / 2;
    const y = entity.y - entity.sprite.height * 0.5 - h - 4;
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
