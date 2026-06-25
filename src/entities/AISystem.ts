import { DESIGN } from '../core/DesignSpace';
import type { AirplaneDef, BombDef, LevelPack } from '../data/types';
import type { CombatEntity } from './CombatEntity';
import type { PatrolMotion } from './EntityTraits';

const TICK_SCALE = 60;

export interface AIUpdateContext {
  dt: number;
  level: LevelPack;
  dropBomb: (
    parent: CombatEntity,
    def: BombDef,
    x: number,
    y: number,
    velocity?: { vx: number; vy: number },
  ) => void;
  spawnChild: (parent: CombatEntity, typeName: string, x: number, y: number) => void;
  skyBomb: (def: BombDef, x: number) => void;
}

const AI_ALIASES: Record<string, string> = {
  KIHELISIMPLE: 'HELISIMPLE',
  KIHELIAPACHE: 'HELIAPACHE',
  KIFIGHTERLIZZARD: 'FIGHTERLIZZARD',
  KICARRIER: 'CARRIER',
  KIPARACHUTE: 'PARACHUTE',
};

export function normalizeAI(ai: string): string {
  const upper = ai.toUpperCase();
  return AI_ALIASES[upper] ?? upper;
}

function flipHorizontal(entity: CombatEntity, dir: 1 | -1): void {
  entity.sprite.scale.x = Math.abs(entity.sprite.scale.x) * dir;
}

function tryDropWeapon(
  entity: CombatEntity,
  def: AirplaneDef,
  level: LevelPack,
  weaponIndex: number,
  x: number,
  y: number,
  ctx: AIUpdateContext,
): void {
  const name = def.weapons[weaponIndex];
  if (!name) return;
  const bombDef = level.bombs[name];
  if (bombDef) ctx.dropBomb(entity, bombDef, x, y);
}

function rollWeaponDrop(
  entity: CombatEntity,
  def: AirplaneDef,
  dt: number,
  ctx: AIUpdateContext,
): void {
  const rand = def.aiParams[2] || 300;
  if (Math.random() >= dt / (rand / TICK_SCALE)) return;
  tryDropWeapon(entity, def, ctx.level, 0, entity.x, entity.y + 20, ctx);
}

function patrolEdges(motion: PatrolMotion, entity: CombatEntity, speed: number, dt: number): void {
  entity.x += motion.dir * speed * dt;
  if (entity.x > DESIGN.width + 120) {
    motion.dir = -1;
    flipHorizontal(entity, -1);
    motion.altChanges = 0;
  } else if (entity.x < -120) {
    motion.dir = 1;
    flipHorizontal(entity, 1);
    motion.altChanges = 0;
  }
}

function driftY(motion: PatrolMotion, entity: CombatEntity, dt: number, rate = 2): void {
  entity.y += (motion.targetY - entity.y) * Math.min(1, dt * rate);
}

function maybeRetargetY(motion: PatrolMotion, def: AirplaneDef, dt: number, chance = 0.3): void {
  const [minY, maxY] = def.aiParams;
  if (Math.random() < dt * chance) {
    motion.targetY = minY + Math.random() * (maxY - minY);
    motion.altChanges += 1;
  }
}

function applyDrawStyle(entity: CombatEntity, def: AirplaneDef, motion: PatrolMotion): void {
  if (def.drawStyle === 1) {
    entity.sprite.rotation = motion.dir > 0 ? 0 : Math.PI;
  } else if (def.drawStyle === 2) {
    entity.sprite.rotation = motion.dir * 0.12;
  }
}

function updateBomberSimple(entity: CombatEntity, motion: PatrolMotion, def: AirplaneDef, ctx: AIUpdateContext): void {
  const speed = def.speed * TICK_SCALE;
  patrolEdges(motion, entity, speed, ctx.dt);
  driftY(motion, entity, ctx.dt);
  maybeRetargetY(motion, def, ctx.dt);
  rollWeaponDrop(entity, def, ctx.dt, ctx);
  applyDrawStyle(entity, def, motion);
}

function updateBomberRandom(entity: CombatEntity, motion: PatrolMotion, def: AirplaneDef, ctx: AIUpdateContext): void {
  const speed = def.speed * TICK_SCALE;
  patrolEdges(motion, entity, speed, ctx.dt);
  driftY(motion, entity, ctx.dt);
  if (motion.altChanges < 3) maybeRetargetY(motion, def, ctx.dt, 0.5);
  rollWeaponDrop(entity, def, ctx.dt, ctx);
  applyDrawStyle(entity, def, motion);
}

function updateBomberHard(entity: CombatEntity, motion: PatrolMotion, def: AirplaneDef, ctx: AIUpdateContext): void {
  const speed = def.speed * TICK_SCALE;
  patrolEdges(motion, entity, speed, ctx.dt);
  driftY(motion, entity, ctx.dt, 1.5);
  maybeRetargetY(motion, def, ctx.dt, 0.2);

  const rand = def.aiParams[2] || 300;
  if (Math.random() < ctx.dt / (rand / TICK_SCALE)) {
    const bombDef = ctx.level.bombs[def.weapons[0] ?? ''];
    if (bombDef) {
      for (let i = -2; i <= 2; i++) {
        ctx.dropBomb(entity, bombDef, entity.x + i * 45, entity.y + 20);
      }
    }
  }
  applyDrawStyle(entity, def, motion);
}

function updateFighterSimple(entity: CombatEntity, motion: PatrolMotion, def: AirplaneDef, ctx: AIUpdateContext): void {
  const speed = def.speed * TICK_SCALE * 1.15;
  patrolEdges(motion, entity, speed, ctx.dt);
  driftY(motion, entity, ctx.dt, 4);
  maybeRetargetY(motion, def, ctx.dt, 0.8);
  rollWeaponDrop(entity, def, ctx.dt, ctx);
  applyDrawStyle(entity, def, motion);
}

function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function rotateToward(current: number, target: number, maxDelta: number): number {
  current = normalizeAngle(current);
  target = normalizeAngle(target);
  let delta = target - current;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + Math.max(-maxDelta, Math.min(maxDelta, delta));
}

function pickFighterMgTargetX(currentX: number): number {
  const margin = 160;
  const minX = margin;
  const maxX = DESIGN.width - margin;
  let x = minX + Math.random() * (maxX - minX);
  if (Math.abs(x - currentX) < 220) {
    x = currentX < DESIGN.width / 2
      ? maxX - Math.random() * 280
      : minX + Math.random() * 280;
  }
  return x;
}

function steerToward(
  entity: CombatEntity,
  def: AirplaneDef,
  targetX: number,
  targetY: number,
  speed: number,
  dt: number,
): boolean {
  const dx = targetX - entity.x;
  const dy = targetY - entity.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 40) return true;

  const move = Math.min(dist, speed * dt);
  entity.x += (dx / dist) * move;
  entity.y += (dy / dist) * move;

  if (def.drawStyle === 1) {
    const targetAngle = Math.atan2(dy, dx);
    const turnRate = def.rotationSpeed * (Math.PI / 180) * TICK_SCALE;
    entity.sprite.rotation = rotateToward(entity.sprite.rotation, targetAngle, turnRate * dt);
  }
  return false;
}

function tryDropDirectionalWeapon(
  entity: CombatEntity,
  def: AirplaneDef,
  level: LevelPack,
  weaponIndex: number,
  ctx: AIUpdateContext,
): void {
  const name = def.weapons[weaponIndex];
  if (!name) return;
  const bombDef = level.bombs[name];
  if (!bombDef) return;

  const angle = entity.sprite.rotation;
  const bulletSpeed = bombDef.speed * TICK_SCALE;
  const nose = 24;
  ctx.dropBomb(
    entity,
    bombDef,
    entity.x + Math.cos(angle) * nose,
    entity.y + Math.sin(angle) * nose,
    {
      vx: Math.cos(angle) * bulletSpeed,
      vy: Math.sin(angle) * bulletSpeed,
    },
  );
}

function rollDirectionalWeaponDrop(
  entity: CombatEntity,
  def: AirplaneDef,
  dt: number,
  ctx: AIUpdateContext,
): void {
  const rand = def.aiParams[2] || 5;
  if (Math.random() >= dt / (rand / TICK_SCALE)) return;
  tryDropDirectionalWeapon(entity, def, ctx.level, 0, ctx);
}

function updateFighterMg(entity: CombatEntity, motion: PatrolMotion, def: AirplaneDef, ctx: AIUpdateContext): void {
  const [minY, maxY] = def.aiParams;
  const highY = minY + 80;
  const lowY = maxY - 40;
  const speed = def.speed * TICK_SCALE * 1.15;

  if (motion.phase === 0) {
    if (steerToward(entity, def, motion.targetX, highY, speed, ctx.dt)) {
      motion.phase = 1;
      motion.targetX = pickFighterMgTargetX(entity.x);
    }
  } else if (motion.phase === 1) {
    rollDirectionalWeaponDrop(entity, def, ctx.dt, ctx);
    if (steerToward(entity, def, motion.targetX, lowY, speed * 1.1, ctx.dt)) {
      motion.phase = 2;
      motion.targetX = pickFighterMgTargetX(entity.x);
    }
  } else if (steerToward(entity, def, motion.targetX, highY, speed, ctx.dt)) {
    motion.phase = 0;
    motion.targetX = pickFighterMgTargetX(entity.x);
  }
}

function updateHeliSimple(entity: CombatEntity, motion: PatrolMotion, def: AirplaneDef, ctx: AIUpdateContext): void {
  const speed = def.speed * TICK_SCALE * 0.85;
  patrolEdges(motion, entity, speed, ctx.dt);
  motion.phaseT += ctx.dt;
  entity.y += Math.sin(motion.phaseT * 3) * 18 * ctx.dt;
  driftY(motion, entity, ctx.dt, 1.2);
  rollWeaponDrop(entity, def, ctx.dt, ctx);
  applyDrawStyle(entity, def, motion);
}

function updateHeliApache(entity: CombatEntity, motion: PatrolMotion, def: AirplaneDef, ctx: AIUpdateContext): void {
  const [minY, maxY] = def.aiParams;
  const speed = def.speed * TICK_SCALE;

  if (motion.phase === 0) {
    entity.x += motion.dir * speed * ctx.dt;
    entity.y += (minY + (maxY - minY) * 0.15 - entity.y) * Math.min(1, ctx.dt * 2);
    if (entity.x > DESIGN.width * 0.25 && entity.x < DESIGN.width * 0.75) motion.phase = 1;
    if (entity.x > DESIGN.width + 80 || entity.x < -80) motion.phase = 2;
  } else if (motion.phase === 1) {
    entity.x += motion.dir * speed * 1.4 * ctx.dt;
    entity.y += (maxY - entity.y) * Math.min(1, ctx.dt * 3);
    rollWeaponDrop(entity, def, ctx.dt, ctx);
    if (entity.y >= maxY - 20) motion.phase = 2;
  } else {
    entity.x += motion.dir * speed * 1.2 * ctx.dt;
    entity.y += (minY - entity.y) * Math.min(1, ctx.dt * 2.5);
    if (entity.x > DESIGN.width + 120 || entity.x < -120) {
      motion.phase = 0;
      motion.dir = entity.x > DESIGN.width / 2 ? -1 : 1;
      flipHorizontal(entity, motion.dir);
    }
  }
  applyDrawStyle(entity, def, motion);
}

function updateFighterLizzard(entity: CombatEntity, motion: PatrolMotion, def: AirplaneDef, ctx: AIUpdateContext): void {
  const [minY, maxY] = def.aiParams;
  const speed = def.speed * TICK_SCALE;

  if (motion.phase === 0) {
    entity.x += motion.dir * speed * ctx.dt;
    entity.y += (minY - entity.y) * Math.min(1, ctx.dt * 1.5);
    if (Math.random() < ctx.dt * 0.15) motion.phase = 1;
    patrolEdges(motion, entity, 0, ctx.dt);
  } else if (motion.phase === 1) {
    entity.y += (maxY - entity.y) * Math.min(1, ctx.dt * 4);
    entity.x += motion.dir * speed * 0.6 * ctx.dt;
    rollWeaponDrop(entity, def, ctx.dt, ctx);
    if (entity.y >= maxY - 30) {
      motion.phase = 2;
      tryDropWeapon(entity, def, ctx.level, 1, entity.x, entity.y + 10, ctx);
      tryDropWeapon(entity, def, ctx.level, 1, entity.x - 30, entity.y, ctx);
      tryDropWeapon(entity, def, ctx.level, 1, entity.x + 30, entity.y, ctx);
    }
  } else {
    entity.y += (minY - entity.y) * Math.min(1, ctx.dt * 3);
    entity.x += motion.dir * speed * ctx.dt;
    if (entity.y <= minY + 40) motion.phase = 0;
    patrolEdges(motion, entity, 0, ctx.dt);
  }
  applyDrawStyle(entity, def, motion);
}

function updateCarrier(entity: CombatEntity, motion: PatrolMotion, def: AirplaneDef, ctx: AIUpdateContext): void {
  const speed = def.speed * TICK_SCALE * 0.7;
  patrolEdges(motion, entity, speed, ctx.dt);
  driftY(motion, entity, ctx.dt, 0.8);
  maybeRetargetY(motion, def, ctx.dt, 0.15);

  motion.phaseT += ctx.dt;
  if (motion.phaseT > 2.5) {
    motion.phaseT = 0;
    const childType = def.weapons[0];
    if (childType && ctx.level.airplanes[childType]) {
      ctx.spawnChild(entity, childType, entity.x, entity.y + 30);
    }
  }
  applyDrawStyle(entity, def, motion);
}

function updateParachute(entity: CombatEntity, motion: PatrolMotion, def: AirplaneDef, ctx: AIUpdateContext): void {
  const [startX, endX] = def.aiParams;
  const targetX = motion.dir > 0 ? endX : startX;
  const dx = targetX - entity.x;
  const speed = def.speed * TICK_SCALE;
  entity.x += Math.sign(dx) * speed * ctx.dt;
  entity.y += (DESIGN.groundY - 80 - entity.y) * Math.min(1, ctx.dt * 1.5);
  if (Math.abs(dx) < 20 || entity.y >= DESIGN.groundY - 90) {
    entity.alive = false;
    entity.sprite.visible = false;
    const bombDef = ctx.level.bombs[def.weapons[0] ?? ''];
    if (bombDef) ctx.dropBomb(entity, bombDef, entity.x, entity.y + 40);
  }
}

function updateBoss(entity: CombatEntity, motion: PatrolMotion, def: AirplaneDef, ctx: AIUpdateContext): void {
  const speed = def.speed * TICK_SCALE;
  patrolEdges(motion, entity, speed * 0.9, ctx.dt);
  driftY(motion, entity, ctx.dt, 1.2);
  maybeRetargetY(motion, def, ctx.dt, 0.25);

  motion.phaseT += ctx.dt;
  const ai = motion.ai;

  if (ai === 'BARON' || ai === 'VOGEL') {
    rollWeaponDrop(entity, def, ctx.dt, ctx);
    if (motion.phaseT > 1.8) {
      motion.phaseT = 0;
      tryDropWeapon(entity, def, ctx.level, 1, entity.x, entity.y + 10, ctx);
    }
  } else if (ai === 'RICE') {
    if (motion.phaseT > 0.6) {
      motion.phaseT = 0;
      tryDropWeapon(entity, def, ctx.level, motion.phase % 2, entity.x, entity.y + 15, ctx);
      motion.phase += 1;
    }
  } else if (ai === 'BUSH') {
    rollWeaponDrop(entity, def, ctx.dt, ctx);
    if (motion.phaseT > 1.2) {
      motion.phaseT = 0;
      const bombName = def.weapons[0];
      const bombDef = bombName ? ctx.level.bombs[bombName] : undefined;
      if (bombDef) ctx.skyBomb(bombDef, 120 + Math.random() * (DESIGN.width - 240));
    }
  }

  applyDrawStyle(entity, def, motion);
}

export function updateAirplaneAI(
  entity: CombatEntity,
  motion: PatrolMotion,
  ctx: AIUpdateContext,
): void {
  if (!entity.alive) return;
  const def = entity.airplaneDef!;

  switch (motion.ai) {
    case 'BOMBERSIMPLE':
      updateBomberSimple(entity, motion, def, ctx);
      break;
    case 'BOMBERRANDOM':
      updateBomberRandom(entity, motion, def, ctx);
      break;
    case 'BOMBERHARD':
      updateBomberHard(entity, motion, def, ctx);
      break;
    case 'FIGHTERSIMPLE':
      updateFighterSimple(entity, motion, def, ctx);
      break;
    case 'FIGHTERMG':
      updateFighterMg(entity, motion, def, ctx);
      break;
    case 'HELISIMPLE':
      updateHeliSimple(entity, motion, def, ctx);
      break;
    case 'HELIAPACHE':
      updateHeliApache(entity, motion, def, ctx);
      break;
    case 'FIGHTERLIZZARD':
      updateFighterLizzard(entity, motion, def, ctx);
      break;
    case 'CARRIER':
      updateCarrier(entity, motion, def, ctx);
      break;
    case 'PARACHUTE':
      updateParachute(entity, motion, def, ctx);
      break;
    case 'BARON':
    case 'VOGEL':
    case 'RICE':
    case 'BUSH':
      updateBoss(entity, motion, def, ctx);
      break;
    default:
      updateBomberSimple(entity, motion, def, ctx);
      break;
  }
}

export function createPatrolMotion(
  def: AirplaneDef,
  x: number,
  spawnIndex: number,
  isEndmaster: boolean,
): PatrolMotion {
  const [minY, maxY] = [def.aiParams[0], def.aiParams[1]];
  const ai = normalizeAI(def.ai);
  const targetX =
    ai === 'FIGHTERMG'
      ? x + (x < DESIGN.width / 2 ? 360 : -360)
      : x;
  return {
    kind: 'patrol',
    ai,
    dir: x < DESIGN.width / 2 ? 1 : -1,
    targetX,
    targetY: minY + Math.random() * Math.max(1, maxY - minY),
    bombTimer: 0,
    phase: ai === 'FIGHTERMG' ? 1 : 0,
    phaseT: 0,
    altChanges: 0,
    spawnIndex,
    isEndmaster,
  };
}
