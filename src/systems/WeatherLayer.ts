import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { loadTexture } from '../data/AssetLoader';

const SNOWFLAKE_PATH = 'assets/gfx/snowflake.png';

interface RainParticle {
  x: number;
  y: number;
  vy: number;
  vx: number;
  len: number;
}

interface SnowParticle {
  sprite: Sprite;
  x: number;
  y: number;
  vy: number;
  vx: number;
  spin: number;
  scale: number;
  alpha: number;
}

const MAX_RAIN = 420;
const MAX_SNOW = 320;

export class WeatherLayer extends Container {
  private gfx = new Graphics();
  private snowLayer = new Container();
  private rainParticles: RainParticle[] = [];
  private snowParticles: SnowParticle[] = [];
  private snowTex: Texture | null = null;
  private snowReady = false;
  private rain = 0;
  private snow = 0;
  private wind = 0;

  constructor() {
    super();
    this.addChild(this.snowLayer, this.gfx);
    this.eventMode = 'none';
    void this.loadSnowflake();
  }

  private async loadSnowflake(): Promise<void> {
    this.snowTex = await loadTexture(SNOWFLAKE_PATH);
    if (this.destroyed) return;
    this.snowReady = true;
    if (this.snow > 0) this.rebuildSnow();
  }

  setWeather(values: number[]): void {
    this.rain = values[0] ?? 0;
    this.snow = values[2] ?? 0;
    this.wind = values[3] ?? 0;
    this.rainParticles = [];
    this.snowParticles = [];
    this.snowLayer.removeChildren();

    const rainCount =
      this.rain > 0 ? Math.min(MAX_RAIN, Math.round(this.rain * 260 + 24)) : 0;

    for (let i = 0; i < rainCount; i++) {
      this.rainParticles.push(this.spawnRainParticle(true));
    }

    if (this.snow > 0 && this.snowReady) {
      this.rebuildSnow();
    }
    if (rainCount === 0 && this.snow <= 0) this.gfx.clear();
  }

  private snowCount(): number {
    return this.snow > 0 ? Math.min(MAX_SNOW, Math.round(this.snow * 220 + 32)) : 0;
  }

  private rebuildSnow(): void {
    this.snowLayer.removeChildren();
    this.snowParticles = [];
    if (!this.snowTex || this.snow <= 0) return;

    const count = this.snowCount();
    for (let i = 0; i < count; i++) {
      const data = this.spawnSnowParticle(true);
      const sprite = new Sprite(this.snowTex);
      sprite.anchor.set(0.5);
      sprite.scale.set(data.scale);
      sprite.alpha = data.alpha;
      sprite.rotation = Math.random() * Math.PI * 2;
      sprite.position.set(data.x, data.y);
      this.snowLayer.addChild(sprite);
      this.snowParticles.push({ ...data, sprite });
    }
  }

  private spawnRainParticle(randomY = false): RainParticle {
    const intensity = Math.max(0.35, this.rain);
    return {
      x: Math.random() * DESIGN.width,
      y: randomY ? Math.random() * DESIGN.height : -Math.random() * DESIGN.height * 0.25,
      vy: (1100 + Math.random() * 700) * intensity,
      vx: this.wind * 55 + (Math.random() - 0.5) * 18,
      len: 14 + Math.random() * 20,
    };
  }

  private spawnSnowParticle(randomY = false): Omit<SnowParticle, 'sprite'> {
    const intensity = Math.max(0.35, this.snow);
    return {
      x: Math.random() * DESIGN.width,
      y: randomY ? Math.random() * DESIGN.height : -Math.random() * DESIGN.height * 0.2,
      vy: (55 + Math.random() * 70) * intensity,
      vx: this.wind * 24 + (Math.random() - 0.5) * 16,
      spin: (Math.random() - 0.5) * 2.5,
      scale: 0.22 + Math.random() * 0.28,
      alpha: 0.72 + Math.random() * 0.22,
    };
  }

  private respawnSnow(index: number): void {
    const data = this.spawnSnowParticle(false);
    const p = this.snowParticles[index]!;
    p.x = data.x;
    p.y = data.y;
    p.vy = data.vy;
    p.vx = data.vx;
    p.spin = data.spin;
    p.scale = data.scale;
    p.alpha = data.alpha;
    p.sprite.scale.set(data.scale);
    p.sprite.alpha = data.alpha;
    p.sprite.rotation = Math.random() * Math.PI * 2;
    p.sprite.position.set(data.x, data.y);
  }

  update(dt: number): void {
    if (this.rain <= 0 && this.snow <= 0) return;

    for (let i = 0; i < this.rainParticles.length; i++) {
      const p = this.rainParticles[i]!;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > DESIGN.height + 30 || p.x < -50 || p.x > DESIGN.width + 50) {
        this.rainParticles[i] = this.spawnRainParticle(false);
      }
    }

    for (let i = 0; i < this.snowParticles.length; i++) {
      const p = this.snowParticles[i]!;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.sprite.rotation += p.spin * dt;
      p.sprite.position.set(p.x, p.y);
      if (p.y > DESIGN.height + 20 || p.x < -50 || p.x > DESIGN.width + 50) {
        this.respawnSnow(i);
      }
    }

    if (this.rainParticles.length > 0) {
      this.gfx.clear();
      for (const p of this.rainParticles) {
        this.gfx.moveTo(p.x, p.y).lineTo(p.x - p.vx * 0.014, p.y - p.len).stroke({
          color: 0xb8dcff,
          width: 1.6,
          alpha: 0.72,
        });
      }
    } else {
      this.gfx.clear();
    }
  }
}
