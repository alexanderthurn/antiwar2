import { Container, Particle, ParticleContainer, Sprite, type Texture } from 'pixi.js';
import { GROUND_SURFACE_Y } from '../../core/DesignSpace';
import type { EffectQuality } from '../../core/GraphicsQuality';
import { loadTexture } from '../../data/AssetLoader';
import type { CombatEntity } from '../../entities/CombatEntity';
import { spritesOverlap } from '../collision';
import { napalmGroundLifeSec } from '../NapalmHazardManager';
import { sliceFireSheet } from './sliceFireSheet';
import { sliceParticleSheet } from './sliceParticleSheet';

const SHEET_COLS = 4;
const SHEET_ROWS = 4;
const BLOOD_FRAME_START = 0;
const BLOOD_FRAME_COUNT = 4;
const SPARK_FIRE_FRAME_START = 0;
const SPARK_FIRE_FRAME_COUNT = 4;
const NAPALM_FIRE_FRAME_COUNT = 5;
const NAPALM_BLOB_ANIM_S = 0.1;
/** human.png walk frame on screen: 344 × 0.2 ≈ 69px tall. */
const CIVILIAN_DISPLAY_HEIGHT = 344 * 0.2;
/** fire.png is 145×67, five frames → ~29×67 per frame. */
const NAPALM_FRAME_H = 67;
/** Align napalm pool with civilian feet (ground strip + 2px). */
const NAPALM_GROUND_Y = GROUND_SURFACE_Y + 2;
const NAPALM_BLOB_GRAVITY = 34;
const NAPALM_BURN_TICK_S = 0.35;
const NAPALM_RAIN_EXTINGUISH = 2.4;
/** Start fading when this fraction of lifetime remains (0.65 = last 65% fades out). */
const NAPALM_FADE_START_RATIO = 0.65;
const CLOUD_FRAME_START = 4;
const CLOUD_FRAME_COUNT = 8;
/** Second row of particle.png — dark metal shrapnel. */
const DEBRIS_FRAME_START = 4;
const DEBRIS_FRAME_COUNT = 4;
/** Third row of particle.png — animated damage smoke. */
const PLANE_SMOKE_FRAME_START = 8;
const PLANE_SMOKE_FRAME_COUNT = 4;
const PLANE_SMOKE_ANIM_FRAME_S = 0.07;
const BLOOD_PARTICLE_SCALE = 2;
const BLOOD_SCALE_MIN = 0.07 * BLOOD_PARTICLE_SCALE;
const BLOOD_SCALE_MAX = 0.22 * BLOOD_PARTICLE_SCALE;
const BLOOD_GROW_MAX = 0.022 * BLOOD_PARTICLE_SCALE;

export interface BloodSpawnArea {
  cx: number;
  cy: number;
  width: number;
  height: number;
}

export interface CivilianBloodOpts {
  damage: number;
  explosionType?: number;
  explosionRange?: number;
  /** Non-lethal hit — lighter spray than a kill. */
  wound?: boolean;
  /** Cheat / test tier (0–6) — bypasses global budget and uses dramatic per-tier counts. */
  intensityTier?: number;
  /** Random start position within this rectangle (e.g. human sprite bounds). */
  spawnArea?: BloodSpawnArea;
  /** Impact origin — blood sprays away from this point. */
  hitFrom?: { x: number; y: number };
  /** v1 BLOODY level multiplier. */
  bloody?: number;
}

interface BloodHitBias {
  /** -1 = spray left, +1 = spray right, 0 = symmetric. */
  lateral: number;
  /** 1 = full cone width, lower = tighter directional fan. */
  spreadSymmetry: number;
}

/** Particle count per strength tier (0–6). */
const BLOOD_COUNT_BY_TIER: Record<EffectQuality, number[]> = {
  low: [0, 0, 0, 0, 0, 0, 0],
  normal: [10, 36, 95, 185, 330, 530, 760],
  high: [14, 52, 130, 265, 460, 720, 1020],
  ultra: [18, 68, 165, 330, 580, 920, 1280],
};

/** Tiers 0–2: farther fling. Tiers 3–6: shorter arc, denser cloud. */
const BLOOD_SPEED_BY_TIER = [1.6, 1.95, 2.3, 1.5, 1.38, 1.28, 1.18];
const BLOOD_SPREAD_BY_TIER = [1.15, 1.4, 1.7, 1.45, 1.32, 1.22, 1.12];
const BLOOD_GRAVITY_BY_TIER = [228, 224, 220, 262, 272, 282, 292];

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
  animFrames?: Texture[];
  animFrameTime?: number;
  animTimer?: number;
  napalmHazard?: boolean;
  hazardDamage?: number;
}

interface TrailEmitter {
  entityId: number;
  cooldown: number;
  kind: 'rocket' | 'crash' | 'bomb' | 'damagedPlane';
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

interface NapalmBlob {
  sprite: Sprite;
  frames: Texture[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  animTimer: number;
  frameIdx: number;
  settled: boolean;
  burnCooldown: number;
}

export interface NapalmBurnTarget {
  id: number;
  alive: boolean;
  sprite: Sprite;
}

export interface NapalmExplosionOpts {
  lifetime?: number;
  power?: number;
}

interface QualityProfile {
  budget: number;
  rocketInterval: number;
  crashInterval: number;
  bombInterval: number;
  planeSmokeInterval: number;
}

const QUALITY: Record<EffectQuality, QualityProfile | null> = {
  low: null,
  normal: {
    budget: 130,
    rocketInterval: 0.042,
    crashInterval: 0.034,
    bombInterval: 0.09,
    planeSmokeInterval: 0.065,
  },
  high: {
    budget: 240,
    rocketInterval: 0.028,
    crashInterval: 0.022,
    bombInterval: 0.06,
    planeSmokeInterval: 0.048,
  },
  ultra: {
    budget: 320,
    rocketInterval: 0.02,
    crashInterval: 0.016,
    bombInterval: 0.045,
    planeSmokeInterval: 0.036,
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
  damagedAirplanes: CombatEntity[];
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
  private debrisFrames: Texture[] = [];
  private planeSmokeFrames: Texture[] = [];
  private sparkFireFrames: Texture[] = [];
  private napalmFireFrames: Texture[] = [];
  private bloodFrames: Texture[] = [];
  private readonly trailEmitters = new Map<number, TrailEmitter>();
  private readonly groundFires: GroundFireEmitter[] = [];
  private readonly napalmBlobs: NapalmBlob[] = [];
  private napalmRain = 0;
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
    this.sparkFireFrames = sliceParticleSheet(
      sheet,
      SHEET_COLS,
      SHEET_ROWS,
      SPARK_FIRE_FRAME_START,
      SPARK_FIRE_FRAME_COUNT,
    );
    const napalmSheet = await loadTexture('assets/gfx/fire.png');
    this.napalmFireFrames = sliceFireSheet(napalmSheet, NAPALM_FIRE_FRAME_COUNT);
    this.cloudFrames = sliceParticleSheet(
      sheet,
      SHEET_COLS,
      SHEET_ROWS,
      CLOUD_FRAME_START,
      CLOUD_FRAME_COUNT,
    );
    this.debrisFrames = sliceParticleSheet(
      sheet,
      SHEET_COLS,
      SHEET_ROWS,
      DEBRIS_FRAME_START,
      DEBRIS_FRAME_COUNT,
    );
    this.planeSmokeFrames = sliceParticleSheet(
      sheet,
      SHEET_COLS,
      SHEET_ROWS,
      PLANE_SMOKE_FRAME_START,
      PLANE_SMOKE_FRAME_COUNT,
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
    for (const blob of this.napalmBlobs) blob.sprite.destroy();
    this.napalmBlobs.length = 0;
  }

  clearBlood(): void {
    const pool = this.pools.get('fxBlood');
    if (!pool) return;
    for (const entry of pool.live) this.recycle(entry);
    pool.live.length = 0;
    pool.container.update();
  }

  update(dt: number, buckets: EntityBuckets, opts?: { rain?: number }): void {
    if (!this.loaded || !this.trailLayer || !this.fxLayer) return;

    this.napalmRain = opts?.rain ?? 0;
    const profile = QUALITY[this.quality];
    this.syncTrailEmitters(buckets, profile);
    if (profile) {
      this.tickTrailEmitters(dt, buckets, profile);
      this.tickGroundFires(dt, profile);
      this.tickNapalmBlobs(dt);
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

  /** Dark metal shards when a rocket damages an airplane without destroying it. */
  spawnAirplaneHitDebris(x: number, y: number, spread = 22): void {
    const profile = QUALITY[this.quality];
    if (!profile || this.debrisFrames.length === 0) return;

    const count = profile.budget >= 200 ? 9 : 6;
    for (let i = 0; i < count; i++) {
      if (!this.hasBudget()) break;
      const px = x + (Math.random() - 0.5) * spread * 2;
      const py = y + (Math.random() - 0.5) * spread * 2;
      const vx = (Math.random() - 0.5) * 50;
      const vy = 40 + Math.random() * 60;
      this.pushDebris({
        x: px,
        y: py,
        vx,
        vy,
        life: 0.5 + Math.random() * 0.4,
        scale: 0.2 + Math.random() * 0.05,
        grow: 0,
        tint: this.pickDebrisTint(),
        peakAlpha: 0.88,
        gravity: 320,
      });
    }
  }

  /** Damage civilians whose sprites overlap a napalm blob (not invisible radii). */
  queryNapalmBurnHits(targets: NapalmBurnTarget[]): { civilianId: number; damage: number; hitX: number; hitY: number }[] {
    const hits: { civilianId: number; damage: number; hitX: number; hitY: number }[] = [];

    for (const blob of this.napalmBlobs) {
      if (blob.life <= 0 || blob.sprite.alpha < 0.08 || blob.burnCooldown > 0) continue;

      let hitAny = false;
      for (const target of targets) {
        if (!target.alive) continue;
        if (!spritesOverlap(blob.sprite, target.sprite)) continue;
        hits.push({
          civilianId: target.id,
          damage: 14,
          hitX: blob.sprite.x,
          hitY: blob.sprite.y,
        });
        hitAny = true;
      }
      if (hitAny) blob.burnCooldown = NAPALM_BURN_TICK_S;
    }

    return hits;
  }

  /** type: 1=normal, 2=anthrax, 3=nuke, 4=napalm */
  spawnExplosion(
    x: number,
    y: number,
    type: number,
    radius: number,
    opts?: NapalmExplosionOpts,
  ): void {
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
      const lifetime = opts?.lifetime ?? 40;
      const groundLife = napalmGroundLifeSec(lifetime);
      const airborne = y < GROUND_SURFACE_Y - 20;
      this.spawnNapalmBlobs(x, y, radius, groundLife, airborne);
      return;
    }

    this.burstFire(x, y, scale * mul, 8);
    this.ringSmoke(x, y, radius, scale * mul, 0xf0f4ff, 12);
  }

  /** Blood spray when a civilian is hit or killed — intensity scales with damage source and graphics quality. */
  spawnCivilianBlood(x: number, y: number, opts: CivilianBloodOpts): void {
    const profile = QUALITY[this.quality];
    if (!profile || this.bloodFrames.length === 0) return;

    const strengthTier = this.bloodStrengthTier(opts);
    const count = this.bloodParticleCount(opts, profile);
    const allowOverflow = count > 24;
    const extreme = !opts.wound && strengthTier >= 4;
    const speedMul = BLOOD_SPEED_BY_TIER[strengthTier] ?? 1;
    const spreadMul = BLOOD_SPREAD_BY_TIER[strengthTier] ?? 1;
    const gravity = BLOOD_GRAVITY_BY_TIER[strengthTier] ?? 290;
    const hitBias = this.bloodHitBias(opts.spawnArea, opts.hitFrom);
    const cheatMode = opts.intensityTier != null;

    for (let i = 0; i < count; i++) {
      if (!cheatMode && !this.canSpawnBlood(allowOverflow, count)) break;

      const speed =
        ((extreme ? 95 : 48) +
          Math.random() * (extreme ? 210 : 105) +
          Math.min(opts.damage, 800) * 0.035) *
        speedMul;
      const { x: px, y: py } = this.randomBloodSpawnPoint(x, y, opts.spawnArea);
      const { vx, vy } = this.bloodBurstVelocity(speed, spreadMul, extreme, hitBias);

      this.pushBlood(
        {
          x: px,
          y: py,
          vx,
          vy,
          life: (extreme ? 0.6 : 0.38) + Math.random() * (extreme ? 0.75 : 0.48),
          scale: this.bloodParticleSize(),
          grow: this.bloodParticleGrow(),
          tint: this.pickBloodTint(),
          peakAlpha: 0.82 + Math.random() * 0.15,
          gravity,
        },
        cheatMode,
      );
    }

    if (extreme) {
      const extra = Math.round(count * (cheatMode ? 0.5 : 0.38));
      for (let i = 0; i < extra; i++) {
        if (!cheatMode && !this.canSpawnBlood(true, count)) break;
        const popSpeed = (32 + Math.random() * 55) * speedMul;
        const { x: px, y: py } = this.randomBloodSpawnPoint(x, y, opts.spawnArea);
        const sideKick = hitBias.lateral * 58 * spreadMul;
        this.pushBlood(
          {
            x: px,
            y: py,
            vx: sideKick + (Math.random() - 0.5) * 95 * spreadMul * hitBias.spreadSymmetry,
            vy: -popSpeed,
            life: 0.28 + Math.random() * 0.38,
            scale: this.bloodParticleSize() * 0.85,
            grow: this.bloodParticleGrow() * 0.8,
            tint: this.pickBloodTint(),
            peakAlpha: 0.75,
            gravity: gravity + 8,
          },
          cheatMode,
        );
      }
    }
  }

  private bloodParticleSize(): number {
    const raw = BLOOD_SCALE_MIN + Math.random() * (BLOOD_SCALE_MAX - BLOOD_SCALE_MIN);
    return Math.min(raw, BLOOD_SCALE_MAX);
  }

  private bloodParticleGrow(): number {
    return BLOOD_GROW_MAX * (0.6 + Math.random() * 0.5);
  }

  private randomBloodSpawnPoint(
    x: number,
    y: number,
    area?: BloodSpawnArea,
  ): { x: number; y: number } {
    if (!area) return { x, y };
    return {
      x: area.cx + (Math.random() - 0.5) * area.width,
      y: area.cy + (Math.random() - 0.5) * area.height,
    };
  }

  private bloodHitBias(
    area: BloodSpawnArea | undefined,
    hitFrom?: { x: number; y: number },
  ): BloodHitBias {
    if (!area || !hitFrom) return { lateral: 0, spreadSymmetry: 1 };

    const dx = hitFrom.x - area.cx;
    const headTop = area.cy - area.height * 0.42;

    // Head-on hit from above — fan out both ways.
    if (hitFrom.y < headTop && Math.abs(dx) < area.width * 0.42) {
      return { lateral: 0, spreadSymmetry: 1 };
    }

    const sideReach = Math.max(area.width * 0.38, 22);
    const lateral = -Math.max(-1, Math.min(1, dx / sideReach));

    // High glancing hit — mostly up, mild sideways lean.
    if (hitFrom.y < area.cy - area.height * 0.12) {
      return { lateral: lateral * 0.3, spreadSymmetry: 0.88 };
    }

    const focus = 0.5 + Math.abs(lateral) * 0.22;
    return { lateral, spreadSymmetry: focus };
  }

  /** Upward spray with generous left/right spread (screen Y grows downward). */
  private bloodBurstVelocity(
    speed: number,
    spreadMul: number,
    extreme: boolean,
    hitBias: BloodHitBias,
  ): { vx: number; vy: number } {
    const lateralShift = hitBias.lateral * (extreme ? 0.82 : 0.62);
    const centerAngle = -Math.PI / 2 + lateralShift;
    const spread = (extreme ? 1.9 : 1.35) * spreadMul * hitBias.spreadSymmetry;
    const angle = centerAngle + (Math.random() - 0.5) * spread;
    const lift = speed * (0.95 + Math.random() * 0.5);
    const horizontal = 0.62 + Math.random() * 0.45;
    const upwardBoost = extreme ? 1.22 : 1.08;
    return {
      vx: Math.cos(angle) * lift * horizontal,
      vy: Math.sin(angle) * lift * upwardBoost,
    };
  }

  private bloodStrengthTier(opts: CivilianBloodOpts): number {
    if (opts.intensityTier != null) {
      return Math.max(0, Math.min(6, opts.intensityTier));
    }

    let damage = opts.damage;
    if (opts.explosionType === 3) damage *= 1.5;
    else if (opts.explosionType === 4) damage *= 1.2;

    let tier = 0;
    if (damage >= 2000) tier = 6;
    else if (damage >= 800) tier = 5;
    else if (damage >= 250) tier = 4;
    else if (damage >= 100) tier = 3;
    else if (damage >= 50) tier = 2;
    else if (damage >= 20) tier = 1;

    return opts.wound ? Math.min(tier, 2) : tier;
  }

  private bloodyScale(opts: CivilianBloodOpts): number {
    const b = opts.bloody ?? 1;
    return Math.max(0.5, Math.min(10, b));
  }

  private bloodParticleCount(opts: CivilianBloodOpts, profile: QualityProfile): number {
    const tier = this.bloodStrengthTier(opts);
    const counts = BLOOD_COUNT_BY_TIER[this.quality] ?? BLOOD_COUNT_BY_TIER.normal;
    const fromTier = counts[tier] ?? 5;
    const scaled = Math.round(fromTier * this.bloodyScale(opts));
    if (opts.wound) {
      return Math.max(2, Math.round(scaled * 0.35));
    }
    if (opts.intensityTier != null || profile.budget >= 130) {
      return scaled;
    }
    return Math.max(2, Math.round(scaled * 0.6));
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

    for (const plane of buckets.damagedAirplanes) {
      activeIds.add(plane.id);
      this.trailEmitters.set(plane.id, {
        entityId: plane.id,
        cooldown: this.trailEmitters.get(plane.id)?.cooldown ?? 0,
        kind: 'damagedPlane',
        guided: false,
        bombType: 1,
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
      ...buckets.damagedAirplanes.map((e) => ({ e, kind: 'damagedPlane' as const })),
    ];

    for (const { e, kind } of all) {
      const emitter = this.trailEmitters.get(e.id);
      if (!emitter) continue;

      const interval =
        kind === 'rocket'
          ? profile.rocketInterval
          : kind === 'crash'
            ? profile.crashInterval
            : kind === 'damagedPlane'
              ? profile.planeSmokeInterval
              : profile.bombInterval;

      emitter.cooldown -= dt;
      while (emitter.cooldown <= 0 && this.hasBudget()) {
        if (kind === 'rocket') this.emitRocketTrail(e, emitter.guided);
        else if (kind === 'crash') this.emitCrashTrail(e);
        else if (kind === 'damagedPlane') this.emitDamagedPlaneSmoke(e);
        else this.emitBombTrail(e, emitter.bombType);
        emitter.cooldown += interval + (Math.random() - 0.5) * interval * 0.4;
      }
    }
  }

  private tickNapalmBlobs(dt: number): void {
    for (let i = this.napalmBlobs.length - 1; i >= 0; i--) {
      const blob = this.napalmBlobs[i]!;
      const rainFactor = this.napalmRain * NAPALM_RAIN_EXTINGUISH;
      blob.life -= dt * (1 + rainFactor);
      blob.burnCooldown = Math.max(0, blob.burnCooldown - dt);
      if (blob.life <= 0) {
        blob.sprite.destroy();
        this.napalmBlobs.splice(i, 1);
        continue;
      }

      if (!blob.settled) {
        blob.x += blob.vx * dt;
        blob.y += blob.vy * dt;
        blob.vy += NAPALM_BLOB_GRAVITY * dt;
        blob.vx *= 1 - dt * 0.35;

        if (blob.y >= NAPALM_GROUND_Y) {
          blob.y = NAPALM_GROUND_Y;
          blob.vy = 0;
          blob.vx *= 0.85;
          blob.settled = true;
        }
      } else {
        blob.vx *= 1 - dt * 0.5;
        blob.x += blob.vx * dt;
      }

      blob.sprite.x = blob.x;
      blob.sprite.y = blob.y;

      blob.animTimer += dt;
      if (blob.animTimer >= NAPALM_BLOB_ANIM_S) {
        blob.animTimer = 0;
        blob.frameIdx = (blob.frameIdx + 1) % blob.frames.length;
        const frame = blob.frames[blob.frameIdx];
        if (frame) blob.sprite.texture = frame;
      }

      const lifeRatio = blob.life / Math.max(0.01, blob.maxLife);
      let alpha: number;
      if (lifeRatio >= NAPALM_FADE_START_RATIO) {
        alpha = 0.92;
      } else {
        const t = lifeRatio / NAPALM_FADE_START_RATIO;
        alpha = 0.92 * t ** 1.25;
      }
      blob.sprite.alpha = alpha;
    }
  }

  /**
   * Few large fire.png blobs (~human height on screen), drifting down slowly.
   * Frame source: 29×67px; at scale ~1.0 → ~29×67 on screen (civilian is ~51×69).
   */
  private spawnNapalmBlobs(
    x: number,
    y: number,
    radius: number,
    life: number,
    airborne: boolean,
  ): void {
    if (!this.fxLayer || this.napalmFireFrames.length === 0) return;

    const frame0 = this.napalmFireFrames[0];
    if (!frame0) return;

    const frameH = frame0.height || NAPALM_FRAME_H;
    const humanScale = CIVILIAN_DISPLAY_HEIGHT / frameH;
    const count = airborne
      ? 3 + Math.floor(Math.random() * 2)
      : Math.max(2, Math.min(4, Math.round(radius / 70)));

    for (let i = 0; i < count; i++) {
      const scale = humanScale * (1.05 + Math.random() * 0.45);
      const sprite = new Sprite(frame0);
      sprite.anchor.set(0.5, 1);

      const spread = radius * (0.55 + Math.random() * 0.75);
      const bx = x + (Math.random() - 0.5) * spread * 2;
      const by = airborne
        ? y + (Math.random() - 0.5) * Math.max(24, radius * 0.35)
        : NAPALM_GROUND_Y + (Math.random() - 0.5) * 4;

      sprite.x = bx;
      sprite.y = by;
      sprite.scale.set(scale);
      sprite.alpha = 0.9;
      this.fxLayer.addChild(sprite);

      this.napalmBlobs.push({
        sprite,
        frames: this.napalmFireFrames,
        x: bx,
        y: by,
        vx: airborne ? (Math.random() - 0.5) * 14 : (Math.random() - 0.5) * 8,
        vy: airborne ? 18 + Math.random() * 28 : 0,
        life,
        maxLife: life,
        animTimer: Math.random() * NAPALM_BLOB_ANIM_S,
        frameIdx: Math.floor(Math.random() * this.napalmFireFrames.length),
        settled: !airborne,
        burnCooldown: 0,
      });
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

  private emitDamagedPlaneSmoke(plane: CombatEntity): void {
    const w = Math.abs(plane.sprite.width);
    const h = Math.abs(plane.sprite.height);
    for (let i = 0; i < 2; i++) {
      this.pushPlaneSmoke({
        x: plane.x + (Math.random() - 0.5) * w * 0.45,
        y: plane.y + (Math.random() - 0.5) * h * 0.25,
        vx: (Math.random() - 0.5) * 16,
        vy: -38 - Math.random() * 42,
        life: 0.55 + Math.random() * 0.45,
        scale: 0.22 + Math.random() * 0.16,
        grow: 0.24,
        tint: this.pickPlaneSmokeTint(),
        peakAlpha: 0.62,
        gravity: -12,
      });
    }
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
      this.pushSmoke('trailSmoke', {
        x: bomb.x + (Math.random() - 0.5) * 8,
        y: bomb.y + 6 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 10,
        vy: 10 + Math.random() * 16,
        life: 0.35 + Math.random() * 0.25,
        scale: 0.12 + Math.random() * 0.08,
        grow: 0.08,
        tint: 0xffaa66,
        peakAlpha: 0.42,
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

  private burstFire(
    x: number,
    y: number,
    scale: number,
    count: number,
    tint = 0xffffff,
    opts?: { napalmHazard?: boolean; hazardDamage?: number; shortLife?: boolean },
  ): void {
    for (let i = 0; i < count; i++) {
      if (!this.hasBudget()) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = (opts?.shortLife ? 55 : 40) + Math.random() * (opts?.shortLife ? 110 : 90) * scale;
      const life = opts?.shortLife
        ? 0.12 + Math.random() * 0.22
        : 0.15 + Math.random() * 0.25;
      this.pushFire('fxFire', {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        scale: (0.1 + Math.random() * 0.12) * scale,
        grow: 0.05 * scale,
        tint,
        peakAlpha: 0.9,
        gravity: opts?.shortLife ? 120 : 80,
        napalmHazard: opts?.napalmHazard,
        hazardDamage: opts?.hazardDamage,
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

  private pushDebris(opts: {
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
  }): void {
    const frame = this.pickDebrisFrame();
    if (!frame) return;
    this.pushParticle('fxSmoke', frame, opts);
  }

  private pushPlaneSmoke(opts: {
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
  }): void {
    if (this.planeSmokeFrames.length === 0 || !this.hasBudget()) return;

    const particle = this.acquire('trailSmoke', this.planeSmokeFrames[0]!);
    particle.x = opts.x;
    particle.y = opts.y;
    particle.rotation = Math.random() * Math.PI * 2;
    particle.scaleX = opts.scale;
    particle.scaleY = opts.scale;
    particle.alpha = opts.peakAlpha;
    particle.tint = opts.tint;
    particle.anchorX = 0.5;
    particle.anchorY = 0.5;

    this.pools.get('trailSmoke')!.live.push({
      pool: 'trailSmoke',
      particle,
      life: opts.life,
      maxLife: opts.life,
      vx: opts.vx,
      vy: opts.vy,
      spin: (Math.random() - 0.5) * 0.5,
      grow: opts.grow,
      baseScale: opts.scale,
      peakAlpha: opts.peakAlpha,
      gravity: opts.gravity,
      animFrames: this.planeSmokeFrames,
      animFrameTime: PLANE_SMOKE_ANIM_FRAME_S,
      animTimer: 0,
    });
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
      napalmHazard?: boolean;
      hazardDamage?: number;
    },
  ): void {
    const frame = this.pickSparkFireFrame();
    if (!frame) return;
    this.pushParticle(poolId, frame, opts, false, {
      napalmHazard: opts.napalmHazard,
      hazardDamage: opts.hazardDamage,
    });
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
    extra?: Pick<LiveParticle, 'animFrames' | 'animFrameTime' | 'animTimer' | 'napalmHazard' | 'hazardDamage'>,
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
      animFrames: extra?.animFrames,
      animFrameTime: extra?.animFrameTime,
      animTimer: extra?.animTimer,
      napalmHazard: extra?.napalmHazard,
      hazardDamage: extra?.hazardDamage,
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
        entry.vy += entry.gravity * dt;
        entry.particle.x += entry.vx * dt;
        entry.particle.y += entry.vy * dt;
        entry.particle.rotation += entry.spin * dt;

        if (entry.animFrames && entry.animFrames.length > 0 && entry.animFrameTime) {
          entry.animTimer = (entry.animTimer ?? 0) + dt;
          const frameIdx = Math.min(
            entry.animFrames.length - 1,
            Math.floor(entry.animTimer / entry.animFrameTime),
          );
          entry.particle.texture = entry.animFrames[frameIdx]!;
        }

        if (this.particleHitGround(entry)) {
          this.recycle(entry);
          pool.live.splice(i, 1);
          continue;
        }

        const scale = entry.baseScale + entry.grow * t;
        entry.particle.scaleX = scale;
        entry.particle.scaleY = scale;
        entry.particle.alpha = fade * entry.peakAlpha;
        entry.vx *= 1 - dt * 1.8;
        if (entry.gravity === 0) entry.vy *= 1 - dt * 1.8;
        else if (entry.gravity < 0) entry.vy *= 1 - dt * 0.35;
      }
    }
  }

  /** Blood and falling fire/smoke die at the ground surface instead of sinking through. */
  private particleHitGround(entry: LiveParticle): boolean {
    if (entry.particle.y < GROUND_SURFACE_Y) return false;
    if (entry.pool === 'fxBlood') return true;
    if (entry.pool === 'fxFire' && entry.gravity > 0) return true;
    if (entry.pool === 'fxSmoke' && entry.gravity > 0) return true;
    return false;
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

  private pickSparkFireFrame(): Texture | null {
    if (this.sparkFireFrames.length === 0) return null;
    return this.sparkFireFrames[Math.floor(Math.random() * this.sparkFireFrames.length)] ?? null;
  }

  private pickBloodFrame(): Texture | null {
    if (this.bloodFrames.length === 0) return null;
    return this.bloodFrames[Math.floor(Math.random() * this.bloodFrames.length)] ?? null;
  }

  private pickDebrisFrame(): Texture | null {
    if (this.debrisFrames.length === 0) return null;
    return this.debrisFrames[Math.floor(Math.random() * this.debrisFrames.length)] ?? null;
  }

  private pickDebrisTint(): number {
    const tints = [0xbbbbbb, 0x999999, 0x888888, 0xaaaaaa, 0x777777];
    return tints[Math.floor(Math.random() * tints.length)] ?? 0x999999;
  }

  private pickPlaneSmokeTint(): number {
    const tints = [0x666666, 0x777777, 0x555555, 0x888888, 0x444444];
    return tints[Math.floor(Math.random() * tints.length)] ?? 0x666666;
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
