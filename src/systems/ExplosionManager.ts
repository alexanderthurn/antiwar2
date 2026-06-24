import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { loadTexture } from '../data/AssetLoader';

const EXPLOSION_COLS = 4;
const EXPLOSION_ROWS = 3;
const EXPLOSION_FRAME_COUNT = EXPLOSION_COLS * EXPLOSION_ROWS;

interface Spark {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
}

interface Burst {
  sprite: Sprite;
  glow: Sprite;
  frames: Texture[];
  ring: Graphics;
  sparks: Spark[];
  age: number;
  duration: number;
  pixelScale: number;
  hasGlow: boolean;
  hasRing: boolean;
}

function sliceExplosionFrames(sheet: Texture): Texture[] {
  const frameW = Math.floor(sheet.width / EXPLOSION_COLS);
  const frameH = Math.floor(sheet.height / EXPLOSION_ROWS);
  const frames: Texture[] = [];

  for (let i = 0; i < EXPLOSION_FRAME_COUNT; i++) {
    const col = i % EXPLOSION_COLS;
    const row = Math.floor(i / EXPLOSION_COLS);
    const rect = new Rectangle(col * frameW, row * frameH, frameW, frameH);
    frames.push(
      new Texture({
        source: sheet.source,
        frame: rect,
        orig: rect,
      }),
    );
  }
  return frames;
}

/** Animated explosions — v1 sprite sheet is 4×3 frames, left-to-right, top-to-bottom. */
export class ExplosionManager {
  private framesNormal: Texture[] = [];
  private framesNuke: Texture[] = [];
  private readonly bursts: Burst[] = [];
  private layer: Container | null = null;
  private loaded = false;
  private particleQuality: 'low' | 'normal' | 'high' = 'normal';

  setParticleQuality(quality: 'low' | 'normal' | 'high'): void {
    this.particleQuality = quality;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    const normalSheet = await loadTexture('assets/gfx/explosion.png');
    const nukeSheet = await loadTexture('assets/gfx/explosion_nuke.png');
    this.framesNormal = sliceExplosionFrames(normalSheet);
    this.framesNuke = sliceExplosionFrames(nukeSheet);
    this.loaded = true;
  }

  attach(layer: Container): void {
    this.layer = layer;
  }

  /** type: 1=normal, 2=anthrax, 3=nuke, 4=napalm */
  spawn(x: number, y: number, type: number, radius: number): void {
    if (!this.layer || !this.loaded) return;

    const isNuke = type >= 3;
    const frames = isNuke ? this.framesNuke : this.framesNormal;
    const first = frames[0];
    if (!first) return;

    const duration = type === 4 ? 0.72 : isNuke ? 0.84 : 0.6;
    const baseScale = Math.max(0.5, Math.min(3.2, radius / 55));
    const tint =
      type === 2 ? 0x88ff44 : type === 4 ? 0xff6622 : type === 3 ? 0xffffff : 0xffffff;
    const pixelScale = (baseScale * radius) / Math.max(first.width, first.height);
    const quality = this.particleQuality;

    const sprite = new Sprite(first);
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    sprite.tint = tint;
    sprite.alpha = 0.95;
    sprite.scale.set(pixelScale);
    sprite.blendMode = 'add';
    this.layer.addChild(sprite);

    let glow: Sprite | null = null;
    if (quality !== 'low') {
      glow = new Sprite(first);
      glow.anchor.set(0.5);
      glow.position.set(x, y);
      glow.tint = type === 2 ? 0x44aa22 : 0xffaa44;
      glow.alpha = quality === 'high' ? 0.55 : 0.45;
      glow.scale.set(pixelScale * (quality === 'high' ? 1.25 : 1.15));
      glow.blendMode = 'add';
      this.layer.addChild(glow);
    }

    const ring = new Graphics();
    if (quality !== 'low') {
      ring.circle(0, 0, radius * 0.5).fill({
        color: type === 2 ? 0x66cc33 : type === 3 ? 0xff8844 : 0xff6600,
        alpha: quality === 'high' ? 0.45 : 0.35,
      });
      ring.position.set(x, y);
      ring.scale.set(0.3);
      this.layer.addChild(ring);
    }

    const sparkMul = quality === 'high' ? 1.6 : quality === 'normal' ? 1 : 0;
    const sparkCount = sparkMul > 0 ? Math.round((isNuke ? 16 : 10) * sparkMul) : 0;
    const sparks: Spark[] = [];
    for (let i = 0; i < sparkCount; i++) {
      const angle = (Math.PI * 2 * i) / sparkCount + Math.random() * 0.4;
      const speed = 80 + Math.random() * 160;
      const g = new Graphics();
      g.circle(0, 0, 2 + Math.random() * 3).fill({
        color: type === 2 ? 0xaaff66 : 0xffcc66,
        alpha: 0.9,
      });
      g.position.set(x, y);
      g.blendMode = 'add';
      this.layer.addChild(g);
      sparks.push({
        g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.35,
      });
    }

    this.bursts.push({
      sprite,
      glow: glow ?? sprite,
      frames,
      ring,
      sparks,
      age: 0,
      duration,
      pixelScale,
      hasGlow: glow != null,
      hasRing: quality !== 'low',
    });
  }

  update(dt: number): void {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]!;
      b.age += dt;
      const t = Math.min(1, b.age / b.duration);
      const fade = 1 - t ** 1.4;

      const frameIdx = Math.min(
        EXPLOSION_FRAME_COUNT - 1,
        Math.floor(t * EXPLOSION_FRAME_COUNT),
      );
      const frame = b.frames[frameIdx] ?? b.frames[0]!;
      b.sprite.texture = frame;
      if (b.hasGlow) {
        b.glow.texture = frame;
        b.glow.alpha = fade * (b.hasGlow ? 0.45 : 0);
      }
      b.sprite.alpha = fade * 0.95;

      const grow = 0.85 + t * 0.35;
      b.sprite.scale.set(b.pixelScale * grow);
      if (b.hasGlow) b.glow.scale.set(b.pixelScale * grow * 1.12);

      if (b.hasRing) {
        b.ring.scale.set(0.3 + t * 1.4);
        b.ring.alpha = fade * 0.45;
      }

      for (const spark of b.sparks) {
        spark.life -= dt;
        spark.g.x += spark.vx * dt;
        spark.g.y += spark.vy * dt;
        spark.vy += 120 * dt;
        spark.g.alpha = Math.max(0, spark.life / 0.4);
      }

      if (b.age >= b.duration) {
        b.sprite.destroy();
        if (b.hasGlow && b.glow !== b.sprite) b.glow.destroy();
        if (b.hasRing) b.ring.destroy();
        for (const spark of b.sparks) spark.g.destroy();
        this.bursts.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const b of this.bursts) {
      b.sprite.destroy();
      if (b.hasGlow && b.glow !== b.sprite) b.glow.destroy();
      if (b.hasRing) b.ring.destroy();
      for (const spark of b.sparks) spark.g.destroy();
    }
    this.bursts.length = 0;
  }
}
