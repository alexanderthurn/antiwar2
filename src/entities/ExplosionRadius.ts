import type { BombDef } from '../data/types';
import type { CombatEntity } from './CombatEntity';

const RANGE_TO_PX = 40;

/** Ground / rocket splash radius from bomb JSON (`explosion.range`). */
export function bombExplosionRadius(bombDef?: BombDef): number {
  return (bombDef?.explosion.range ?? 1) * RANGE_TO_PX;
}

/** Visual radius for airplane death / crash — scales with sprite size and HP. */
export function planeExplosionRadius(entity: CombatEntity): number {
  const w = Math.abs(entity.sprite.width);
  const h = Math.abs(entity.sprite.height);
  const visual = Math.max(w, h) * 0.45;
  const hpBonus = Math.sqrt(entity.maxHp) * 2;
  return Math.min(200, Math.max(64, visual + hpBonus));
}

export function planeExplosionType(entity: CombatEntity): number {
  return entity.maxHp > 8000 ? 3 : 1;
}
