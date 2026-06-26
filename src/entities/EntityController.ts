import { Graphics, Sprite, type Container } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import type { AirplaneDef, BombDef, LevelPack } from '../data/types';
import { combatSpeedMultiplier } from '../core/ProfileStore';
import {
  boxesOverlap,
  getBroadPhaseBounds,
  pointHitsSprite,
  projectileSweptBounds,
  rocketHitsSprite,
  rocketSweepStep,
  spritesOverlap,
  bindSpriteCollisionPath,
} from '../systems/collision';
import { createPatrolMotion, updateAirplaneAI, type AIUpdateContext } from './AISystem';
import { CombatEntity } from './CombatEntity';
import {
  bombExplosionRadius,
  planeExplosionRadius,
  planeExplosionType,
} from './ExplosionRadius';
import { traitsForAirplane, traitsForEnemyBomb, traitsForPlayerProjectile } from './entityProfiles';

const TICK_SCALE = 60;
const MAX_SUBMUNITION_DEPTH = 4;

export interface BombSpawnContext {
  loadTex: (path: string) => Promise<import('pixi.js').Texture>;
  layer: { addChild(s: Sprite): void };
}

export interface CivilianHitTarget {
  id: number;
  alive: boolean;
  sprite: Sprite;
}

export interface EntityControllerCallbacks {
  onEntityDeath(entity: CombatEntity, opts?: { skipExplosion?: boolean }): void;
  onGroundExplosion(
    x: number,
    y: number,
    range: number,
    damage: number,
    explosionType: number,
    rumble: 'plane' | 'explosion' | 'none',
    hurtsCivilians?: boolean,
  ): void;
  onDropBomb(
    parent: CombatEntity,
    bombDef: BombDef,
    x: number,
    y: number,
    velocity?: { vx: number; vy: number },
  ): void;
  onSkyBomb(bombDef: BombDef, x: number): void;
  onSpawnChildAirplane(typeName: string, x: number, y: number): void;
  onProjectileRemoved(ownerSlot: number): void;
  onProjectileHit(
    ownerSlot: number,
    target: CombatEntity,
    damage: number,
    killed: boolean,
    guided: boolean,
    hitX: number,
    hitY: number,
    rocketDef: BombDef,
  ): void;
  /** Direct civilian hit by a falling bomb with no explosion (e.g. machine-gun round). */
  onBombHitsCivilian(bomb: CombatEntity, civilianId: number, hitX: number, hitY: number): void;
}

interface PendingDeath {
  entity: CombatEntity;
  submunitions: boolean;
  callEntityDeath: boolean;
  skipDeathExplosion?: boolean;
  despawn: boolean;
  groundExplosion?: {
    x: number;
    y: number;
    range: number;
    damage: number;
    type: number;
    rumble: 'plane' | 'explosion' | 'none';
    hurtsCivilians: boolean;
  };
}

export class EntityController {
  readonly entities: CombatEntity[] = [];
  private homingLines = new Graphics();
  private deathQueue: PendingDeath[] = [];
  private queuedDeath = new Set<CombatEntity>();
  private crashingRockets = 0;

  attachHomingLines(layer: Container): void {
    layer.addChildAt(this.homingLines, 0);
  }

  clear(): void {
    for (const e of this.entities) e.sprite.destroy();
    this.entities.length = 0;
    this.homingLines.clear();
    this.deathQueue.length = 0;
    this.queuedDeath.clear();
  }

  living(): CombatEntity[] {
    return this.entities.filter((e) => e.alive);
  }

  projectiles(): CombatEntity[] {
    return this.entities.filter((e) => e.alive && e.traits.isPlayerProjectile);
  }

  crashingPlanes(): CombatEntity[] {
    return this.entities.filter(
      (e) => e.alive && e.crashing && e.motion.kind === 'fall' && e.motion.crashPlane,
    );
  }

  damagedAirplanes(): CombatEntity[] {
    return this.entities.filter(
      (e) =>
        e.alive &&
        e.traits.countsForRoundWin &&
        !e.crashing &&
        e.motion.kind === 'patrol' &&
        e.maxHp > 0 &&
        e.hp < e.maxHp * 0.5,
    );
  }

  fallingBombs(): CombatEntity[] {
    return this.entities.filter(
      (e) => e.alive && e.motion.kind === 'fall' && !e.traits.isPlayerProjectile && !e.crashing,
    );
  }

  roundWinTargetsAlive(): number {
    return this.entities.filter((e) => e.alive && e.traits.countsForRoundWin).length;
  }

  findLockTargetAt(x: number, y: number): CombatEntity | null {
    const pad = 10;
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i]!;
      if (!e.alive || !e.traits.lockOnTarget || e.stealthHidden || e.crashing) continue;
      const body = getBroadPhaseBounds(e.sprite, pad);
      if (!boxesOverlap(body, { minX: x, maxX: x, minY: y, maxY: y })) continue;
      if (pointHitsSprite(e.sprite, x, y, pad)) return e;
    }
    return null;
  }

  findEndmaster(): CombatEntity | null {
    for (const e of this.entities) {
      if (!e.alive || e.motion.kind !== 'patrol') continue;
      if (e.motion.isEndmaster) return e;
    }
    return null;
  }

  async spawnAirplane(
    def: AirplaneDef,
    x: number,
    y: number,
    spawnIndex: number,
    isEndmaster: boolean,
    loadTex: (path: string) => Promise<import('pixi.js').Texture>,
    layer: { addChild(s: Sprite): void },
  ): Promise<CombatEntity> {
    const tex = await loadTex(def.image);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.scale.set(def.scale[0], def.scale[1]);
    bindSpriteCollisionPath(sprite, def.image, def.scale);
    if (def.drawStyle === 1) {
      sprite.scale.x = Math.abs(sprite.scale.x);
    } else if (x >= DESIGN.width / 2) {
      sprite.scale.x = -Math.abs(sprite.scale.x);
    }
    layer.addChild(sprite);

    const motion = createPatrolMotion(def, x, spawnIndex, isEndmaster);
    const entity = new CombatEntity(sprite, traitsForAirplane(def), motion, {
      x,
      y,
      hp: def.hp,
      damage: 0,
      airplaneDef: def,
    });
    if (def.drawStyle === 1 && motion.kind === 'patrol') {
      entity.sprite.rotation = motion.dir > 0 ? 0 : Math.PI;
    }
    if (def.stealthTicks && def.stealthTicks > 0) {
      entity.stealthPhaseTimer = def.stealthTicks;
      entity.stealthHidden = false;
      entity.sprite.alpha = 1;
    }
    this.entities.push(entity);
    return entity;
  }

  spawnPlayerProjectile(
    sprite: Sprite,
    def: BombDef,
    stats: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      damage: number;
      ownerSlot: number;
      homingTarget: CombatEntity | null;
      guidedShot?: boolean;
    },
    layer: { addChild(s: Sprite): void },
  ): CombatEntity {
    layer.addChild(sprite);
    bindSpriteCollisionPath(sprite, def.image, def.scale);
    const entity = new CombatEntity(sprite, traitsForPlayerProjectile(def), { kind: 'projectile' }, {
      x: stats.x,
      y: stats.y,
      vx: stats.vx,
      vy: stats.vy,
      hp: def.hp,
      damage: stats.damage,
      turnRateDeg: def.rotationSpeed,
      bombDef: def,
    });
    entity.ownerSlot = stats.ownerSlot;
    entity.homingTarget = stats.homingTarget;
    entity.guidedShot = stats.guidedShot ?? false;
    this.entities.push(entity);
    return entity;
  }

  async spawnFallingBomb(
    def: BombDef,
    x: number,
    y: number,
    loadTex: (path: string) => Promise<import('pixi.js').Texture>,
    layer: { addChild(s: Sprite): void },
    submunitionDepth = 0,
    velocity?: { vx: number; vy: number },
  ): Promise<CombatEntity> {
    const tex = await loadTex(def.image);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.scale.set(def.scale[0], def.scale[1]);
    bindSpriteCollisionPath(sprite, def.image, def.scale);
    layer.addChild(sprite);

    const bulletSpeed = def.speed * TICK_SCALE * combatSpeedMultiplier();
    const entity = new CombatEntity(sprite, traitsForEnemyBomb(def), { kind: 'fall' }, {
      x,
      y,
      vx: velocity?.vx ?? 0,
      vy: velocity?.vy ?? bulletSpeed,
      hp: def.hp,
      damage: def.explosion.power,
      explosionRange: def.explosion.range * 40,
      bombDef: def,
    });
    if (velocity) {
      entity.sprite.rotation = Math.atan2(velocity.vy, velocity.vx);
    }
    entity.submunitionDepth = submunitionDepth;
    this.entities.push(entity);
    return entity;
  }

  /** Instantly destroy all on-screen targets the player can shoot (planes, bombs). */
  killVisibleEnemies(
    level: LevelPack,
    spawnCtx: BombSpawnContext,
    cb: EntityControllerCallbacks,
  ): number {
    const margin = 80;
    let count = 0;

    for (const target of this.entities) {
      if (!target.alive || !target.traits.hittableByPlayer || target.traits.isPlayerProjectile) {
        continue;
      }
      if (
        target.x < -margin ||
        target.x > DESIGN.width + margin ||
        target.y < -margin ||
        target.y > DESIGN.height + margin
      ) {
        continue;
      }

      const isPlane = target.traits.countsForRoundWin;
      this.queueDeath({
        entity: target,
        submunitions: target.motion.kind === 'fall',
        callEntityDeath: true,
        despawn: !isPlane,
      });
      count += 1;
    }

    if (count > 0) this.flushDeaths(level, spawnCtx, cb);
    return count;
  }

  /** Mark for removal at end of frame — never splices during simulation. */
  private queueDeath(death: PendingDeath): void {
    if (this.queuedDeath.has(death.entity)) return;
    this.queuedDeath.add(death.entity);
    death.entity.alive = false;
    this.deathQueue.push(death);
  }

  private spawnSubmunitions(
    entity: CombatEntity,
    level: LevelPack,
    ctx: BombSpawnContext,
  ): void {
    const def = entity.bombDef;
    if (!def?.onDeath?.bomb || def.onDeath.count <= 0) return;
    if (entity.submunitionDepth >= MAX_SUBMUNITION_DEPTH) return;
    const childDef = level.bombs[def.onDeath.bomb];
    if (!childDef) return;

    const count = def.onDeath.count;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const radius = 12 + Math.random() * 40;
      const sx = entity.x + Math.cos(angle) * radius;
      const sy = entity.y + Math.sin(angle) * radius * 0.35;
      void this.spawnFallingBomb(
        childDef,
        sx,
        sy,
        ctx.loadTex,
        ctx.layer,
        entity.submunitionDepth + 1,
      );
    }
  }

  private flushDeaths(
    level: LevelPack,
    spawnCtx: BombSpawnContext,
    cb: EntityControllerCallbacks,
  ): void {
    const batch = this.deathQueue.splice(0);
    this.queuedDeath.clear();

    for (const death of batch) {
      const e = death.entity;
      if (death.submunitions) this.spawnSubmunitions(e, level, spawnCtx);
      if (death.groundExplosion) {
        const g = death.groundExplosion;
        cb.onGroundExplosion(g.x, g.y, g.range, g.damage, g.type, g.rumble, g.hurtsCivilians);
      }
      if (death.callEntityDeath) {
        cb.onEntityDeath(e, death.skipDeathExplosion ? { skipExplosion: true } : undefined);
      }

      if (death.despawn) {
        e.sprite.destroy();
        const idx = this.entities.indexOf(e);
        if (idx >= 0) this.entities.splice(idx, 1);
      } else {
        e.sprite.visible = false;
      }
    }
  }

  update(
    dt: number,
    level: LevelPack,
    spawnCtx: BombSpawnContext,
    cb: EntityControllerCallbacks,
    civilians: CivilianHitTarget[] = [],
  ): void {
    this.crashingRockets = level.config.crashingRockets ?? 0;
    this.updateStealth(dt);
    this.updateAirplanes(dt, level, cb);
    this.updateFalling(dt, cb, civilians);
    this.updateProjectiles(dt, cb);
    this.flushDeaths(level, spawnCtx, cb);
    this.redrawHomingLines();
  }

  private updateStealth(dt: number): void {
    for (const e of this.entities) {
      if (!e.alive || e.motion.kind !== 'patrol' || !e.airplaneDef?.stealthTicks) continue;
      const period = e.airplaneDef.stealthTicks;
      e.stealthPhaseTimer -= dt;
      if (e.stealthPhaseTimer > 0) continue;
      e.stealthHidden = !e.stealthHidden;
      e.stealthPhaseTimer = period;
      e.sprite.alpha = e.stealthHidden ? 0.08 : 1;
    }
  }

  private updateAirplanes(dt: number, level: LevelPack, cb: EntityControllerCallbacks): void {
    const ctx: AIUpdateContext = {
      dt,
      level,
      dropBomb: (parent, bombDef, x, y, velocity) =>
        cb.onDropBomb(parent, bombDef, x, y, velocity),
      spawnChild: (_parent, typeName, x, y) => cb.onSpawnChildAirplane(typeName, x, y),
      skyBomb: (bombDef, x) => cb.onSkyBomb(bombDef, x),
    };

    for (const e of this.entities) {
      if (!e.alive || e.motion.kind !== 'patrol') continue;
      updateAirplaneAI(e, e.motion, ctx);
      e.syncSprite();
    }
  }

  private updateFalling(dt: number, cb: EntityControllerCallbacks, civilians: CivilianHitTarget[]): void {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i]!;
      if (!e.alive || e.motion.kind !== 'fall') continue;
      const motion = e.motion;

      if (motion.crashPlane) {
        e.x += (motion.vx ?? 0) * dt;
        e.vy += 320 * dt;
        e.y += e.vy * dt;
        e.sprite.rotation += (motion.spin ?? 0) * dt;
        e.syncSprite();
        if (e.y >= DESIGN.groundY) {
          const range = planeExplosionRadius(e);
          this.queueDeath({
            entity: e,
            submunitions: false,
            callEntityDeath: true,
            skipDeathExplosion: true,
            despawn: true,
            groundExplosion: {
              x: e.x,
              y: DESIGN.groundY,
              range,
              damage: Math.max(50, Math.round(e.maxHp / 20)),
              type: planeExplosionType(e),
              rumble: 'plane',
              hurtsCivilians: true,
            },
          });
        }
        continue;
      }

      const prevX = e.x;
      const prevY = e.y;
      const totalDx = e.vx * dt;
      const totalDy = e.vy * dt;
      const travel = Math.hypot(totalDx, totalDy);
      const steps = Math.max(1, Math.ceil(travel / 12));
      let consumed = false;

      for (let s = 1; s <= steps; s++) {
        e.x = prevX + totalDx * (s / steps);
        e.y = prevY + totalDy * (s / steps);
        if (travel > 0.5) {
          e.sprite.rotation = Math.atan2(totalDy, totalDx);
        }
        e.syncSprite();

        if (e.traits.hurtsHumansOnGround) {
          const civilian = this.findCivilianHit(e, civilians);
          if (civilian) {
            this.resolveBombCivilianHit(e, civilian, cb);
            consumed = true;
            break;
          }
        }
      }

      if (consumed) continue;

      if (e.traits.checkOutOfScreen) {
        const margin = 80;
        if (
          e.x < -margin ||
          e.x > DESIGN.width + margin ||
          e.y < -margin ||
          e.y > DESIGN.height + margin
        ) {
          this.queueDeath({
            entity: e,
            submunitions: false,
            callEntityDeath: false,
            despawn: true,
          });
          continue;
        }
      }

      if (e.y >= DESIGN.groundY) {
        const def = e.bombDef;
        const expRange = e.explosionRange;
        const expPower = def?.explosion.power ?? e.damage;
        const hasExplosion = expRange > 0 || expPower > 0;
        this.queueDeath({
          entity: e,
          submunitions: true,
          callEntityDeath: false,
          despawn: true,
          groundExplosion:
            e.traits.hurtsHumansOnGround && hasExplosion && def
              ? {
                  x: e.x,
                  y: DESIGN.groundY,
                  range: expRange,
                  damage: expPower,
                  type: def.explosion.type,
                  rumble: e.traits.deathRumble,
                  hurtsCivilians: true,
                }
              : undefined,
        });
      }
    }
  }

  private findCivilianHit(bomb: CombatEntity, civilians: CivilianHitTarget[]): CivilianHitTarget | null {
    for (const civilian of civilians) {
      if (!civilian.alive) continue;
      if (spritesOverlap(bomb.sprite, civilian.sprite, 4, 8)) return civilian;
    }
    return null;
  }

  private resolveBombCivilianHit(
    bomb: CombatEntity,
    civilian: CivilianHitTarget,
    cb: EntityControllerCallbacks,
  ): void {
    const def = bomb.bombDef;
    const expRange = bomb.explosionRange;
    const expPower = def?.explosion.power ?? bomb.damage;
    const hasExplosion = expRange > 0 || expPower > 0;

    if (!hasExplosion) {
      cb.onBombHitsCivilian(bomb, civilian.id, bomb.x, bomb.y);
    }

    this.queueDeath({
      entity: bomb,
      submunitions: true,
      callEntityDeath: false,
      despawn: true,
      groundExplosion:
        bomb.traits.hurtsHumansOnGround && hasExplosion && def
          ? {
              x: bomb.x,
              y: DESIGN.groundY,
              range: expRange,
              damage: expPower,
              type: def.explosion.type,
              rumble: bomb.traits.deathRumble,
              hurtsCivilians: true,
            }
          : undefined,
    });
  }

  private startPlaneCrash(entity: CombatEntity): void {
    const horizSpeed = 140;
    const minFallVy = 80;
    let vx: number;
    let vy: number;

    if (entity.airplaneDef?.drawStyle === 1) {
      const angle = entity.sprite.rotation;
      vx = Math.cos(angle) * horizSpeed;
      vy = Math.max(minFallVy, Math.sin(angle) * horizSpeed);
    } else if (entity.motion.kind === 'patrol') {
      vx = entity.motion.dir * horizSpeed;
      vy = 100;
    } else {
      vx = (entity.sprite.scale.x < 0 ? -1 : 1) * horizSpeed;
      vy = 100;
    }

    entity.crashing = true;
    entity.hp = 0;
    entity.stealthHidden = false;
    entity.sprite.alpha = 1;
    entity.motion = {
      kind: 'fall',
      crashPlane: true,
      vx,
      spin: (vx >= 0 ? 1 : -1) * 2.8,
    };
    entity.vy = vy;
  }

  private isPlayerProjectileOutOfScreen(proj: CombatEntity): boolean {
    return (
      proj.x < 0 ||
      proj.x > DESIGN.width ||
      proj.y < 0 ||
      proj.y > DESIGN.height
    );
  }

  /** Impact point when a rocket segment crosses the ground line. */
  private projectileGroundImpact(
    prevX: number,
    prevY: number,
    x: number,
    y: number,
  ): { x: number; y: number } | null {
    const ground = DESIGN.groundY;
    if (prevY < ground && y < ground) return null;

    if (prevY < ground) {
      const dy = y - prevY;
      if (Math.abs(dy) < 1e-9) return { x, y: ground };
      const t = (ground - prevY) / dy;
      return { x: prevX + (x - prevX) * t, y: ground };
    }

    return { x, y: ground };
  }

  private updateProjectiles(dt: number, cb: EntityControllerCallbacks): void {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const proj = this.entities[i]!;
      if (!proj.alive || !proj.traits.isPlayerProjectile) continue;

      proj.steerHoming(dt, TICK_SCALE);

      const startX = proj.x;
      const startY = proj.y;
      const totalDx = proj.vx * dt;
      const totalDy = proj.vy * dt;
      const travel = Math.hypot(totalDx, totalDy);
      const stepSize = rocketSweepStep(proj.sprite);
      const substeps = Math.max(1, Math.ceil(travel / stepSize));

      let prevX = startX;
      let prevY = startY;
      let spent = false;

      for (let s = 1; s <= substeps; s++) {
        const t = s / substeps;
        proj.x = startX + totalDx * t;
        proj.y = startY + totalDy * t;
        proj.syncSprite();

        if (this.isPlayerProjectileOutOfScreen(proj)) {
          cb.onProjectileRemoved(proj.ownerSlot);
          this.queueDeath({ entity: proj, submunitions: false, callEntityDeath: false, despawn: true });
          spent = true;
          break;
        }

        if (this.projectileHitsTarget(proj, prevX, prevY, cb)) {
          cb.onProjectileRemoved(proj.ownerSlot);
          this.queueDeath({ entity: proj, submunitions: false, callEntityDeath: false, despawn: true });
          spent = true;
          break;
        }

        const groundHit = this.projectileGroundImpact(prevX, prevY, proj.x, proj.y);
        if (groundHit) {
          proj.x = groundHit.x;
          proj.y = groundHit.y;
          proj.syncSprite();
          cb.onProjectileRemoved(proj.ownerSlot);
          const range = bombExplosionRadius(proj.bombDef);
          this.queueDeath({
            entity: proj,
            submunitions: false,
            callEntityDeath: false,
            despawn: true,
            groundExplosion: {
              x: groundHit.x,
              y: DESIGN.groundY,
              range,
              damage: proj.damage,
              type: proj.bombDef?.explosion.type ?? 1,
              rumble: 'explosion',
              hurtsCivilians: proj.traits.hurtsHumansOnGround,
            },
          });
          spent = true;
          break;
        }
        prevX = proj.x;
        prevY = proj.y;
      }

      if (spent) continue;

      if (this.isPlayerProjectileOutOfScreen(proj)) {
        cb.onProjectileRemoved(proj.ownerSlot);
        this.queueDeath({ entity: proj, submunitions: false, callEntityDeath: false, despawn: true });
      }
    }
  }

  private projectileHitsTarget(
    proj: CombatEntity,
    prevX: number,
    prevY: number,
    cb: EntityControllerCallbacks,
  ): boolean {
    const swept = projectileSweptBounds(proj.sprite, prevX, prevY);
    const targetPad = 16;

    for (const target of this.entities) {
      if (!target.alive || target === proj || !target.traits.hittableByPlayer) continue;
      if (target.crashing && !target.traits.countsForRoundWin) continue;
      if (!target.crashing && target.stealthHidden && !target.traits.countsForRoundWin) continue;

      if (!boxesOverlap(swept, getBroadPhaseBounds(target.sprite, targetPad))) continue;
      if (!rocketHitsSprite(proj.sprite, target.sprite, prevX, prevY)) continue;

      const hpBefore = target.hp;
      target.hp -= proj.damage;
      const killed = hpBefore > 0 && target.hp <= 0;
      if (target.traits.countsForRoundWin) target.rocketHitCount += 1;
      cb.onProjectileHit(
        proj.ownerSlot,
        target,
        proj.damage,
        killed,
        proj.guidedShot,
        proj.x,
        proj.y,
        proj.bombDef!,
      );
      if (killed) {
        const isPlane = target.traits.countsForRoundWin;
        const shouldCrash =
          isPlane &&
          this.crashingRockets > 0 &&
          target.rocketHitCount >= this.crashingRockets;
        if (shouldCrash) {
          this.startPlaneCrash(target);
        } else {
          this.queueDeath({
            entity: target,
            submunitions: target.motion.kind === 'fall',
            callEntityDeath: true,
            despawn: !isPlane,
          });
        }
      } else if (target.traits.countsForRoundWin && target.crashing) {
        this.queueDeath({
          entity: target,
          submunitions: false,
          callEntityDeath: true,
          despawn: true,
        });
      }
      return true;
    }
    return false;
  }

  private redrawHomingLines(): void {
    this.homingLines.clear();
    let hasLine = false;
    for (const proj of this.projectiles()) {
      const target = proj.homingTarget;
      if (!target?.alive || !target.traits.homingTarget || target.stealthHidden) continue;
      this.homingLines.moveTo(proj.x, proj.y).lineTo(target.x, target.y);
      hasLine = true;
    }
    if (hasLine) {
      this.homingLines.stroke({ color: 0xff2222, width: 2, alpha: 0.8 });
    }
  }
}
