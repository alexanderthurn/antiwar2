import { Container, Particle, ParticleContainer, type Texture } from 'pixi.js';
import { DESIGN } from '../../core/DesignSpace';
import type { EffectQuality } from '../../core/GraphicsQuality';
import { loadTexture } from '../../data/AssetLoader';
import type { CombatEntity } from '../../entities/CombatEntity';
import { sliceParticleSheet } from './sliceParticleSheet';

const SHEET_COLS = 4;
const SHEET_ROWS = 4;
const BLOOD_FRAME_START = 0;
const BLOOD_FRAME_COUNT = 4;
const FIRE_FRAME_START = 0;
const FIRE_FRAME_COUNT = 4;
const CLOUD_FRAME_START = 4;
const CLOUD_FRAME_COUNT = 8;
const BLOOD_PARTICLE_SCALE = 2;

export interface CivilianBloodOpts {
  damage: number;
  explosionType?: number;
  explosionRange?: number;
  /** Cheat / test tier (0–6) — bypasses global budget and uses dramatic per-tier counts. */
  intensityTier?: number;
}

/** Particle count per cheat tier — wide spread so each step is obvious. */
const CHEAT_BLOOD_COUNTS: Record<EffectQuality, number[]> = {
  low: [0, 0, 0, 0, 0, 0, 0],
  normal: [5, 16, 38, 80, 140, 220, 320],
  high: [8, 24, 58, 120, 210, 340, 480],
  ultra: [10, 32, 78, 160, 280, 450, 650],
};

const CHEAT_BLOOD_SCALE_MUL = [1, 1.15, 1.35, 1.6, 2, 2.6, 3.4];
const CHEAT_BLOOD_SPEED_MUL = [1, 1.2, 1.45, 1.75, 2.2, 2.9, 3.8];
const CHEAT_BLOOD_SPREAD_MUL = [1, 1.2, 1.5, 1.9, 2.4, 3.2, 4.5];

type PoolId = 'trailSmoke' | 'fxSmoke' | 'fxFire' | 'fxBlood';

interface LiveParticle {
  pool: PoolId;
  particle: Particle;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  spin: number;
  grow: number;
  baseScale: number;
  peakAlpha: number;
  gravity: number;
}

interface TrailEmitter {
  entityId: number;
  cooldown: number;
  kind: 'rocket' | 'crash' | 'bomb';
  guided: boolean;
  bombType: number;
}

interface GroundFireEmitter {
  x: number;
  y: number;
  life: number;
  cooldown: number;
  radius: number;
}

interface QualityProfile {
  budget: number;
  rocketInterval: number;
  crashInterval: number;
  bombInterval: number;
}

const QUALITY: Record<EffectQuality, QualityProfile | null> = {
  low: null,
  normal: {
    budget: 130,
    rocketInterval: 0.042,
    crashInterval: 0.034,
    bombInterval: 0.09,
  },
  high: {
    budget: 240,
    rocketInterval: 0.028,
    crashInterval: 0.022,
    bombInterval: 0.06,
  },
  ultra: {
    budget: 320,
    rocketInterval: 0.02,
    crashInterval: 0.016,
    bombInterval: 0.045,
  },
};

const POOL_BLEND: Record<PoolId, 'normal' | 'add'> = {
  trailSmoke: 'normal',
  fxSmoke: 'normal',
  fxFire: 'add',
  fxBlood: 'normal',
};

interface EntityBuckets {
  projectiles: CombatEntity[];
  crashingPlanes: CombatEntity[];
  fallingBombs: CombatEntity[];
}

/**
 * Pixi v8 particle effects — trails, bursts, and lingering ground fire.
 */
export class ParticleFxManager {
  private readonly trailRoot = new Container();
  private readonly fxRoot = new Container();

  private readonly pools = new Map<PoolId, {
    container: ParticleContainer;
    live: LiveParticle[];
    free: Particle[];
  }>();

  private cloudFrames: Texture[] = [];
  private fireFrames: Texture[] = [];
  private bloodFrames: Texture[] = [];
  private readonly trailEmitters = new Map<number, TrailEmitter>();
  private readonly groundFires: GroundFireEmitter[] = [];
  private trailLayer: Container | null = null;
  private fxLayer: Container | null = null;
  private loaded = false;
  private quality: EffectQuality = 'normal';

  constructor() {
    for (const id of ['trailSmoke', 'fxSmoke', 'fxFire', 'fxBlood'] as const) {
      const container = new ParticleContainer({
        dynamicProperties: {
          position: true,
          rotation: true,
          vertex: true,
          color: true,
        },
      });
      container.eventMode = 'none';
      container.blendMode = POOL_BLEND[id];
      this.pools.set(id, { container, live: [], free: [] });
    }
    this.trailRoot.eventMode = 'none';
    this.fxRoot.eventMode = 'none';
  }

  setEffectQuality(quality: EffectQuality): void {
    this.quality = quality;
    if (quality === 'low') this.clear();
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    const sheet = await loadTexture('assets/gfx/particle.png');
    this.bloodFrames = sliceParticleSheet(
      sheet,
      SHEET_COLS,
      SHEET_ROWS,
      BLOOD_FRAME_START,
      BLOOD_FRAME_COUNT,
    );
    this.fireFrames = sliceParticleSheet(
      sheet,
      SHEET_COLS,
      SHEET_ROWS,
      FIRE_FRAME_START,
      FIRE_FRAME_COUNT,
    );
    this.cloudFrames = sliceParticleSheet(
      sheet,
      SHEET_COLS,
      SHEET_ROWS,
      CLOUD_FRAME_START,
      CLOUD_FRAME_COUNT,
    );
    this.loaded = true;
  }

  attach(trailLayer: Container, fxLayer: Container): void {
    this.trailLayer = trailLayer;
    this.fxLayer = fxLayer;
    if (!this.trailRoot.parent) trailLayer.addChild(this.trailRoot);
    if (!this.fxRoot.parent) fxLayer.addChild(this.fxRoot);

    const trailSmoke = this.pools.get('trailSmoke')!.container;
    if (!trailSmoke.parent) this.trailRoot.addChild(trailSmoke);

    const fxSmoke = this.pools.get('fxSmoke')!.container;
    const fxFire = this.pools.get('fxFire')!.container;
    const fxBlood = this.pools.get('fxBlood')!.container;
    if (!fxSmoke.parent) this.fxRoot.addChild(fxSmoke);
    if (!fxFire.parent) this.fxRoot.addChild(fxFire);
    if (!fxBlood.parent) this.fxRoot.addChild(fxBlood);
  }

  clear(): void {
    for (const pool of this.pools.values()) {
      for (const entry of pool.live) this.recycle(entry);
      pool.live.length = 0;
      pool.container.update();
    }
    this.trailEmitters.clear();
    this.groundFires.length = 0;
  }

  clearBlood(): void {
    const pool = this.pools.get('fxBlood');
    if (!pool) return;
    for (const entry of pool.live) this.recycle(entry);
    pool.live.length = 0;
    pool.container.update();
  }

  update(dt: number, buckets: EntityBuckets): void {
    if (!this.loaded || !this.trailLayer || !this.fxLayer) return;

    const profile = QUALITY[this.quality];
    this.syncTrailEmitters(buckets, profile);
    if (profile) {
      this.tickTrailEmitters(dt, buckets, profile);
      this.tickGroundFires(dt, profile);
    }
    this.tickLiveParticles(dt);
    for (const pool of this.pools.values()) pool.container.update();
  }

  spawnMuzzleFlash(x: number, y: number, angle: number, guided = false): void {
    const profile = QUALITY[this.quality];
    if (!profile) return;

    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const count = profile.budget >= 200 ? 5 : 4;
    for (let i = 0; i < count; i++) {
      if (!this.hasBudget()) break;
      const spread = (Math.random() - 0.5) * 0.5;
      const dir = angle + Math.PI + spread;
      const speed = 30 + Math.random() * 50;
      this.pushFire('fxFire', {
        x: x - nx * (4 + Math.random() * 6),
        y: y - ny * (4 + Math.random() * 6),
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        life: 0.08 + Math.random() * 0.07,
        scale: 0.1 + Math.random() * 0.08,
        grow: 0.04,
        tint: guided ? 0xffaaaa : 0xffffff,
        peakAlpha: 0.75,
        gravity: 0,
      });
    }
    if (this.hasBudget()) {
      this.pushSmoke('fxSmoke', {
        x: x - nx * 3,
        y: y - ny * 3,
        vx: -nx * 16 + (Math.random() - 0.5) * 10,
        vy: -ny * 16 + (Math.random() - 0.5) * 10,
        life: 0.18 + Math.random() * 0.1,
        scale: 0.12 + Math.random() * 0.06,
        grow: 0.1,
        tint: 0xf0f4ff,
        peakAlpha: 0.45,
        gravity: 0,
      });
    }
  }

  spawnImpact(x: number, y: number, opts: { guided?: boolean; killed?: boolean }): void {
    const profile = QUALITY[this.quality];
    if (!profile) return;

    const mul = opts.killed ? 1.4 : 0.7;
    const fireCount = Math.round((opts.killed ? 5 : 3) * mul);
    const smokeCount = Math.round((opts.killed ? 4 : 2) * mul);
    const tint = opts.guided ? 0xff8888 : 0xffcc88;

    for (let i = 0; i < fireCount; i++) {
      if (!this.hasBudget()) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = (opts.killed ? 50 : 30) + Math.random() * 60;
      this.pushFire('fxFire', {
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.12 + Math.random() * 0.18,
        scale: 0.08 + Math.random() * 0.06,
        grow: 0.02,
        tint,
        peakAlpha: 0.85,
        gravity: 140,
      });
    }

    for (let i = 0; i < smokeCount; i++) {
      if (!this.hasBudget()) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 12 + Math.random() * 24;
      this.pushSmoke('fxSmoke', {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 18,
        life: 0.35 + Math.random() * 0.3,
        scale: 0.14 + Math.random() * 0.1,
        grow: 0.14,
        tint: opts.guided ? 0xffe0e0 : 0xe8eeff,
        peakAlpha: 0.5,
        gravity: 0,
      });
    }
  }

  /** type: 1=normal, 2=anthrax, 3=nuke, 4=napalm */
  spawnExplosion(x: number, y: number, type: number, radius: number): void {
    const profile = QUALITY[this.quality];
    if (!profile) return;

    const scale = Math.max(0.55, Math.min(2.4, radius / 55));
    const mul = profile.budget >= 200 ? 1.5 : 1;

    if (type === 2) {
      this.ringSmoke(x, y, radius, scale * mul, 0x88ff66, 10);
      this.ringSmoke(x, y, radius * 0.6, scale * mul, 0x55cc44, 6);
      return;
    }

    if (type === 3) {
      this.burstFire(x, y, scale * mul * 1.2, 14);
      this.ringSmoke(x, y, radius, scale * mul * 1.3, 0xfff0e0, 16);
      for (let i = 0; i < 8; i++) {
        if (!this.hasBudget()) break;
        this.pushSmoke('fxSmoke', {
          x: x + (Math.random() - 0.5) * radius * 0.4,
          y,
          vx: (Math.random() - 0.5) * 30,
          vy: -60 - Math.random() * 80,
          life: 0.9 + Math.random() * 0.6,
          scale: 0.2 + Math.random() * 0.15,
          grow: 0.25,
          tint: 0xdddddd,
          peakAlpha: 0.55,
          gravity: 0,
        });
      }
      return;
    }

    if (type === 4) {
      this.burstFire(x, y, scale * mul, 10, 0xff6622);
      this.ringSmoke(x, y, radius * 0.7, scale * mul, 0xffaa66, 8);
      this.groundFires.push({
        x,
        y: DESIGN.groundY - 4,
        life: 2.4 + Math.random() * 0.8,
        cooldown: 0,
        radius: radius * 0.55,
      });
      return;
    }

    this.burstFire(x, y, scale * mul, 8);
    this.ringSmoke(x, y, radius, scale * mul, 0xf0f4ff, 12);
  }

  /** Blood spray when a civilian dies — intensity scales with damage source and graphics quality. */
  spawnCivilianBlood(x: number, y: number, opts: CivilianBloodOpts): void {
    const profile = QUALITY[this.quality];
    if (!profile || this.bloodFrames.length === 0) return;

    const cheatTier = opts.intensityTier;
    const cheatMode = cheatTier != null;
    const tierIndex = cheatMode ? Math.max(0, Math.min(6, cheatTier)) : 0;

    const count = this.bloodParticleCount(opts, profile);
    const allowOverflow = count > 24;
    const extreme = cheatMode ? tierIndex >= 4 : count >= 60;
    const scaleMul = cheatMode ? (CHEAT_BLOOD_SCALE_MUL[tierIndex] ?? 1) : 1;
    const speedMul = cheatMode ? (CHEAT_BLOOD_SPEED_MUL[tierIndex] ?? 1) : 1;
    const spreadMul = cheatMode ? (CHEAT_BLOOD_SPREAD_MUL[tierIndex] ?? 1) : 1;

    for (let i = 0; i < count; i++) {
      if (!cheatMode && !this.canSpawnBlood(allowOverflow, count)) break;

      const angle = Math.random() * Math.PI * 2;
      const speed =
        ((extreme ? 70 : 40) +
          Math.random() * (extreme ? 160 : 90) +
          Math.min(opts.damage, 800) * 0.04) *
        speedMul;
      const upward = extreme ? 0.35 + Math.random() * 0.55 : 0.15 + Math.random() * 0.45;
      const spreadX = (extreme ? 28 : 14) * spreadMul;
      const spreadY = (extreme ? 20 : 10) * spreadMul;

      this.pushBlood(
        {
          x: x + (Math.random() - 0.5) * spreadX,
          y: y + (Math.random() - 0.5) * spreadY,
          vx: Math.cos(angle) * speed * (1 - upward * 0.35),
          vy: Math.sin(angle) * speed - (40 + Math.random() * (extreme ? 120 : 60)) * speedMul,
          life: (extreme ? 0.55 : 0.35) + Math.random() * (extreme ? 0.7 : 0.45),
          scale:
            ((extreme ? 0.14 : 0.08) + Math.random() * (extreme ? 0.2 : 0.12)) *
            BLOOD_PARTICLE_SCALE *
            scaleMul,
          grow: (extreme ? 0.04 : 0.02) * BLOOD_PARTICLE_SCALE * scaleMul,
          tint: this.pickBloodTint(),
          peakAlpha: 0.82 + Math.random() * 0.15,
          gravity: (extreme ? 420 : 300) * (cheatMode ? 0.85 + tierIndex * 0.05 : 1),
        },
        cheatMode,
      );
    }

    if (extreme) {
      const extra = Math.round(count * (cheatMode ? 0.45 : 0.35));
      for (let i = 0; i < extra; i++) {
        if (!cheatMode && !this.canSpawnBlood(true, count)) break;
        const angle = Math.random() * Math.PI * 2;
        const dist = (8 + Math.random() * 48) * spreadMul;
        this.pushBlood(
          {
            x: x + Math.cos(angle) * dist,
            y: y + Math.sin(angle) * dist * 0.25,
            vx: Math.cos(angle) * (20 + Math.random() * 50) * speedMul,
            vy: (-10 - Math.random() * 40) * speedMul,
            life: 0.25 + Math.random() * 0.35,
            scale: (0.06 + Math.random() * 0.1) * BLOOD_PARTICLE_SCALE * scaleMul,
            grow: 0.03 * BLOOD_PARTICLE_SCALE * scaleMul,
            tint: this.pickBloodTint(),
            peakAlpha: 0.75,
            gravity: 360,
          },
          cheatMode,
        );
      }
    }
  }

  private bloodParticleCount(opts: CivilianBloodOpts, profile: QualityProfile): number {
    if (opts.intensityTier != null) {
      const tier = Math.max(0, Math.min(6, opts.intensityTier));
      return CHEAT_BLOOD_COUNTS[this.quality][tier] ?? CHEAT_BLOOD_COUNTS.normal[tier] ?? 5;
    }

    const { damage, explosionType = 0, explosionRange = 0 } = opts;
    const qualityMul =
      profile.budget >= 320 ? 2.6 : profile.budget >= 240 ? 1.85 : profile.budget >= 130 ? 1 : 0.6;

    let base = 3;
    if (damage >= 2000) base = 72;
    else if (damage >= 800) base = 48;
    else if (damage >= 300) base = 30;
    else if (damage >= 120) base = 18;
    else if (damage >= 50) base = 10;
    else if (damage >= 20) base = 6;

    if (explosionType === 3) base *= 2.8;
    else if (explosionType === 4) base *= 2;
    else if (explosionType === 2) base *= 1.4;

    if (explosionRange >= 140) base *= 1.5;
    else if (explosionRange >= 80) base *= 1.2;

    return Math.max(2, Math.round(base * qualityMul));
  }

  private canSpawnBlood(allowOverflow: boolean, requested: number): boolean {
    if (!allowOverflow) return this.hasBudget();

    const profile = QUALITY[this.quality];
    if (!profile) return false;

    let total = 0;
    for (const pool of this.pools.values()) total += pool.live.length;
    const ceiling = profile.budget + Math.min(requested, Math.round(profile.budget * 0.85));
    return total < ceiling;
  }

  private pickBloodTint(): number {
    const tints = [0xff1a1a, 0xee1111, 0xcc0000, 0xff3333, 0xaa0000, 0xff4444];
    return tints[Math.floor(Math.random() * tints.length)] ?? 0xee1111;
  }

  private syncTrailEmitters(
    buckets: EntityBuckets,
    profile: QualityProfile | null,
  ): void {
    const activeIds = new Set<number>();

    for (const proj of buckets.projectiles) {
      activeIds.add(proj.id);
      this.trailEmitters.set(proj.id, {
        entityId: proj.id,
        cooldown: this.trailEmitters.get(proj.id)?.cooldown ?? 0,
        kind: 'rocket',
        guided: proj.guidedShot,
        bombType: 1,
      });
    }

    for (const plane of buckets.crashingPlanes) {
      activeIds.add(plane.id);
      this.trailEmitters.set(plane.id, {
        entityId: plane.id,
        cooldown: this.trailEmitters.get(plane.id)?.cooldown ?? 0,
        kind: 'crash',
        guided: false,
        bombType: 1,
      });
    }

    for (const bomb of buckets.fallingBombs) {
      activeIds.add(bomb.id);
      const bombType = bomb.bombDef?.explosion.type ?? 1;
      this.trailEmitters.set(bomb.id, {
        entityId: bomb.id,
        cooldown: this.trailEmitters.get(bomb.id)?.cooldown ?? 0,
        kind: 'bomb',
        guided: false,
        bombType,
      });
    }

    for (const id of this.trailEmitters.keys()) {
      if (!activeIds.has(id)) this.trailEmitters.delete(id);
    }

    if (!profile) this.trailEmitters.clear();
  }

  private tickTrailEmitters(
    dt: number,
    buckets: EntityBuckets,
    profile: QualityProfile,
  ): void {
    const all = [
      ...buckets.projectiles.map((e) => ({ e, kind: 'rocket' as const })),
      ...buckets.crashingPlanes.map((e) => ({ e, kind: 'crash' as const })),
      ...buckets.fallingBombs.map((e) => ({ e, kind: 'bomb' as const })),
    ];

    for (const { e, kind } of all) {
      const emitter = this.trailEmitters.get(e.id);
      if (!emitter) continue;

      const interval =
        kind === 'rocket'
          ? profile.rocketInterval
          : kind === 'crash'
            ? profile.crashInterval
            : profile.bombInterval;

      emitter.cooldown -= dt;
      while (emitter.cooldown <= 0 && this.hasBudget()) {
        if (kind === 'rocket') this.emitRocketTrail(e, emitter.guided);
        else if (kind === 'crash') this.emitCrashTrail(e);
        else this.emitBombTrail(e, emitter.bombType);
        emitter.cooldown += interval + (Math.random() - 0.5) * interval * 0.4;
      }
    }
  }

  private tickGroundFires(dt: number, profile: QualityProfile): void {
    for (let i = this.groundFires.length - 1; i >= 0; i--) {
      const fire = this.groundFires[i]!;
      fire.life -= dt;
      if (fire.life <= 0) {
        this.groundFires.splice(i, 1);
        continue;
      }

      fire.cooldown -= dt;
      const rate = profile.budget >= 200 ? 0.045 : 0.065;
      while (fire.cooldown <= 0 && this.hasBudget()) {
        const px = fire.x + (Math.random() - 0.5) * fire.radius * 2;
        const py = fire.y + (Math.random() - 0.5) * 6;
        if (Math.random() < 0.55) {
          this.pushFire('fxFire', {
            x: px,
            y: py,
            vx: (Math.random() - 0.5) * 16,
            vy: -30 - Math.random() * 40,
            life: 0.25 + Math.random() * 0.25,
            scale: 0.1 + Math.random() * 0.1,
            grow: 0.06,
            tint: Math.random() < 0.5 ? 0xff6622 : 0xffaa44,
            peakAlpha: 0.7,
            gravity: -20,
          });
        } else {
          this.pushSmoke('fxSmoke', {
            x: px,
            y: py,
            vx: (Math.random() - 0.5) * 12,
            vy: -20 - Math.random() * 24,
            life: 0.5 + Math.random() * 0.4,
            scale: 0.16 + Math.random() * 0.1,
            grow: 0.12,
            tint: 0x443322,
            peakAlpha: 0.4,
            gravity: 0,
          });
        }
        fire.cooldown += rate;
      }
    }
  }

  private emitRocketTrail(proj: CombatEntity, guided: boolean): void {
    const speed = Math.hypot(proj.vx, proj.vy);
    if (speed < 1e-3) return;

    const nx = proj.vx / speed;
    const ny = proj.vy / speed;
    const behind = 10 + Math.random() * 6;
    const side = (Math.random() - 0.5) * 8;
    const backAngle = Math.atan2(ny, nx) + Math.PI + (Math.random() - 0.5) * 0.7;

    this.pushSmoke('trailSmoke', {
      x: proj.x - nx * behind - ny * side,
      y: proj.y - ny * behind + nx * side,
      vx: Math.cos(backAngle) * (18 + Math.random() * 34) - nx * 12,
      vy: Math.sin(backAngle) * (18 + Math.random() * 34) - ny * 12,
      life: 0.45 + Math.random() * 0.35,
      scale: 0.14 + Math.random() * 0.1,
      grow: 0.08 + Math.random() * 0.12,
      tint: guided ? 0xffe8e8 : 0xf4f8ff,
      peakAlpha: 0.58,
      gravity: 0,
    });
  }

  private emitCrashTrail(plane: CombatEntity): void {
    const motion = plane.motion;
    const vx = motion.kind === 'fall' ? (motion.vx ?? 0) : 0;
    const spread = 40 + Math.random() * 50;

    if (Math.random() < 0.35 && this.hasBudget()) {
      this.pushFire('fxFire', {
        x: plane.x + (Math.random() - 0.5) * 20,
        y: plane.y + (Math.random() - 0.5) * 14,
        vx: vx * 0.2 + (Math.random() - 0.5) * spread,
        vy: (Math.random() - 0.5) * spread - 20,
        life: 0.2 + Math.random() * 0.2,
        scale: 0.12 + Math.random() * 0.08,
        grow: 0.06,
        tint: 0xff8844,
        peakAlpha: 0.65,
        gravity: 30,
      });
    }

    this.pushSmoke('trailSmoke', {
      x: plane.x + (Math.random() - 0.5) * 24,
      y: plane.y + (Math.random() - 0.5) * 16,
      vx: vx * 0.15 + (Math.random() - 0.5) * 36,
      vy: (Math.random() - 0.5) * 30 - 16,
      life: 0.55 + Math.random() * 0.4,
      scale: 0.18 + Math.random() * 0.12,
      grow: 0.14,
      tint: 0x888888,
      peakAlpha: 0.5,
      gravity: 0,
    });
  }

  private emitBombTrail(bomb: CombatEntity, bombType: number): void {
    const tint =
      bombType === 2 ? 0x99ff88 : bombType === 4 ? 0xffaa66 : 0xd0d8e8;
    const useFire = bombType === 4 && Math.random() < 0.45;

    if (useFire) {
      this.pushFire('fxFire', {
        x: bomb.x + (Math.random() - 0.5) * 8,
        y: bomb.y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 14,
        vy: 8 + Math.random() * 18,
        life: 0.2 + Math.random() * 0.15,
        scale: 0.1 + Math.random() * 0.06,
        grow: 0.04,
        tint: 0xff6622,
        peakAlpha: 0.6,
        gravity: 0,
      });
      return;
    }

    this.pushSmoke('trailSmoke', {
      x: bomb.x + (Math.random() - 0.5) * 6,
      y: bomb.y + 6 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 10,
      vy: 10 + Math.random() * 16,
      life: 0.35 + Math.random() * 0.25,
      scale: 0.1 + Math.random() * 0.06,
      grow: 0.08,
      tint,
      peakAlpha: 0.38,
      gravity: 0,
    });
  }

  private burstFire(x: number, y: number, scale: number, count: number, tint = 0xffffff): void {
    for (let i = 0; i < count; i++) {
      if (!this.hasBudget()) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 90 * scale;
      this.pushFire('fxFire', {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.15 + Math.random() * 0.25,
        scale: (0.1 + Math.random() * 0.12) * scale,
        grow: 0.05 * scale,
        tint,
        peakAlpha: 0.9,
        gravity: 80,
      });
    }
  }

  private ringSmoke(
    x: number,
    y: number,
    radius: number,
    scale: number,
    tint: number,
    count: number,
  ): void {
    for (let i = 0; i < count; i++) {
      if (!this.hasBudget()) break;
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = radius * (0.15 + Math.random() * 0.35);
      const speed = 16 + Math.random() * 32;
      this.pushSmoke('fxSmoke', {
        x: x + Math.cos(angle) * dist * 0.3,
        y: y + Math.sin(angle) * dist * 0.2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 24,
        life: 0.5 + Math.random() * 0.5,
        scale: (0.14 + Math.random() * 0.12) * scale,
        grow: 0.16 * scale,
        tint,
        peakAlpha: 0.55,
        gravity: 0,
      });
    }
  }

  private pushBlood(
    opts: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      scale: number;
      grow: number;
      tint: number;
      peakAlpha: number;
      gravity: number;
    },
    bypassBudget = false,
  ): void {
    const frame = this.pickBloodFrame();
    if (!frame) return;
    this.pushParticle('fxBlood', frame, opts, bypassBudget);
  }

  private pushSmoke(
    poolId: 'trailSmoke' | 'fxSmoke',
    opts: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      scale: number;
      grow: number;
      tint: number;
      peakAlpha: number;
      gravity: number;
    },
  ): void {
    const frame = this.pickCloudFrame();
    if (!frame) return;
    this.pushParticle(poolId, frame, opts);
  }

  private pushFire(
    poolId: 'trailSmoke' | 'fxFire',
    opts: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      scale: number;
      grow: number;
      tint: number;
      peakAlpha: number;
      gravity: number;
    },
  ): void {
    const frame = this.pickFireFrame();
    if (!frame) return;
    this.pushParticle(poolId, frame, opts);
  }

  private pushParticle(
    poolId: PoolId,
    texture: Texture,
    opts: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      scale: number;
      grow: number;
      tint: number;
      peakAlpha: number;
      gravity: number;
    },
    bypassBudget = false,
  ): void {
    if (!bypassBudget && !this.hasBudget()) return;

    const particle = this.acquire(poolId, texture);
    particle.x = opts.x;
    particle.y = opts.y;
    particle.rotation = Math.random() * Math.PI * 2;
    particle.scaleX = opts.scale;
    particle.scaleY = opts.scale;
    particle.alpha = opts.peakAlpha;
    particle.tint = opts.tint;
    particle.anchorX = 0.5;
    particle.anchorY = 0.5;

    this.pools.get(poolId)!.live.push({
      pool: poolId,
      particle,
      life: opts.life,
      maxLife: opts.life,
      vx: opts.vx,
      vy: opts.vy,
      spin: (Math.random() - 0.5) * 1.4,
      grow: opts.grow,
      baseScale: opts.scale,
      peakAlpha: opts.peakAlpha,
      gravity: opts.gravity,
    });
  }

  private tickLiveParticles(dt: number): void {
    for (const pool of this.pools.values()) {
      for (let i = pool.live.length - 1; i >= 0; i--) {
        const entry = pool.live[i]!;
        entry.life -= dt;
        if (entry.life <= 0) {
          this.recycle(entry);
          pool.live.splice(i, 1);
          continue;
        }

        const t = 1 - entry.life / entry.maxLife;
        const fade = (1 - t) ** 1.35;
        entry.particle.x += entry.vx * dt;
        entry.particle.y += entry.vy * dt;
        entry.particle.rotation += entry.spin * dt;
        entry.vy += entry.gravity * dt;
        const scale = entry.baseScale + entry.grow * t;
        entry.particle.scaleX = scale;
        entry.particle.scaleY = scale;
        entry.particle.alpha = fade * entry.peakAlpha;
        entry.vx *= 1 - dt * 1.8;
        if (entry.gravity === 0) entry.vy *= 1 - dt * 1.8;
      }
    }
  }

  private hasBudget(): boolean {
    const profile = QUALITY[this.quality];
    if (!profile) return false;
    let total = 0;
    for (const pool of this.pools.values()) total += pool.live.length;
    return total < profile.budget;
  }

  private pickCloudFrame(): Texture | null {
    if (this.cloudFrames.length === 0) return null;
    return this.cloudFrames[Math.floor(Math.random() * this.cloudFrames.length)] ?? null;
  }

  private pickFireFrame(): Texture | null {
    if (this.fireFrames.length === 0) return null;
    return this.fireFrames[Math.floor(Math.random() * this.fireFrames.length)] ?? null;
  }

  private pickBloodFrame(): Texture | null {
    if (this.bloodFrames.length === 0) return null;
    return this.bloodFrames[Math.floor(Math.random() * this.bloodFrames.length)] ?? null;
  }

  private acquire(poolId: PoolId, texture: Texture): Particle {
    const pool = this.pools.get(poolId)!;
    const particle = pool.free.pop() ?? new Particle({ texture });
    particle.texture = texture;
    pool.container.addParticle(particle);
    return particle;
  }

  private recycle(entry: LiveParticle): void {
    const pool = this.pools.get(entry.pool)!;
    pool.container.removeParticle(entry.particle);
    entry.particle.alpha = 0;
    pool.free.push(entry.particle);
  }
}
