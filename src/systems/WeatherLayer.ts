import { Container, Particle, ParticleContainer, type Texture } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { loadTexture } from '../data/AssetLoader';

const RAINDROP_PATH = 'assets/gfx/raindrop.png';
const SNOWFLAKE_PATH = 'assets/gfx/snowflake.png';

interface RainLive {
  particle: Particle;
  vx: number;
  vy: number;
}

interface SnowLive {
  particle: Particle;
  vx: number;
  vy: number;
  spin: number;
}

const MAX_RAIN = 420;
const MAX_SNOW = 320;

export class WeatherLayer extends Container {
  private readonly rainContainer = new ParticleContainer({
    dynamicProperties: {
      position: true,
      rotation: true,
    },
  });
  private readonly snowContainer = new ParticleContainer({
    dynamicProperties: {
      position: true,
      rotation: true,
    },
  });
  private readonly rainLive: RainLive[] = [];
  private readonly rainFree: Particle[] = [];
  private readonly snowLive: SnowLive[] = [];
  private readonly snowFree: Particle[] = [];
  private rainTex: Texture | null = null;
  private snowTex: Texture | null = null;
  private rainReady = false;
  private snowReady = false;
  private rain = 0;
  private snow = 0;
  private wind = 0;

  constructor() {
    super();
    this.rainContainer.eventMode = 'none';
    this.snowContainer.eventMode = 'none';
    this.addChild(this.rainContainer, this.snowContainer);
    this.eventMode = 'none';
    void this.loadTextures();
  }

  private async loadTextures(): Promise<void> {
    const [rainTex, snowTex] = await Promise.all([
      loadTexture(RAINDROP_PATH),
      loadTexture(SNOWFLAKE_PATH),
    ]);
    if (this.destroyed) return;
    this.rainTex = rainTex;
    this.snowTex = snowTex;
    this.rainReady = true;
    this.snowReady = true;
    if (this.rain > 0) this.rebuildRain();
    if (this.snow > 0) this.rebuildSnow();
  }

  setWeather(values: number[]): void {
    this.rain = values[0] ?? 0;
    this.snow = values[2] ?? 0;
    this.wind = values[3] ?? 0;
    this.clearRain();
    this.clearSnow();

    if (this.rain > 0 && this.rainReady) {
      this.rebuildRain();
    }
    if (this.snow > 0 && this.snowReady) {
      this.rebuildSnow();
    }
  }

  private rainCount(): number {
    return this.rain > 0 ? Math.min(MAX_RAIN, Math.round(this.rain * 260 + 24)) : 0;
  }

  private snowCount(): number {
    return this.snow > 0 ? Math.min(MAX_SNOW, Math.round(this.snow * 220 + 32)) : 0;
  }

  private clearRain(): void {
    for (const entry of this.rainLive) this.recycleRain(entry);
    this.rainLive.length = 0;
    this.rainContainer.update();
  }

  private clearSnow(): void {
    for (const entry of this.snowLive) this.recycleSnow(entry);
    this.snowLive.length = 0;
    this.snowContainer.update();
  }

  private rebuildRain(): void {
    this.clearRain();
    if (!this.rainTex || this.rain <= 0) return;

    const count = this.rainCount();
    for (let i = 0; i < count; i++) this.pushRain(true);
    this.rainContainer.update();
  }

  private rebuildSnow(): void {
    this.clearSnow();
    if (!this.snowTex || this.snow <= 0) return;

    const count = this.snowCount();
    for (let i = 0; i < count; i++) this.pushSnow(true);
    this.snowContainer.update();
  }

  private acquireRain(): Particle {
    const particle = this.rainFree.pop() ?? new Particle({ texture: this.rainTex! });
    particle.texture = this.rainTex!;
    this.rainContainer.addParticle(particle);
    return particle;
  }

  private acquireSnow(): Particle {
    const particle = this.snowFree.pop() ?? new Particle({ texture: this.snowTex! });
    particle.texture = this.snowTex!;
    this.snowContainer.addParticle(particle);
    return particle;
  }

  private recycleRain(entry: RainLive): void {
    this.rainContainer.removeParticle(entry.particle);
    this.rainFree.push(entry.particle);
  }

  private recycleSnow(entry: SnowLive): void {
    this.snowContainer.removeParticle(entry.particle);
    this.snowFree.push(entry.particle);
  }

  private pushRain(randomY: boolean): void {
    const data = this.spawnRainParticle(randomY);
    const particle = this.acquireRain();
    particle.x = data.x;
    particle.y = data.y;
    particle.rotation = rainRotation(data.vx, data.vy);
    particle.scaleX = data.scale;
    particle.scaleY = data.scale;
    particle.alpha = data.alpha;
    particle.anchorX = 0.5;
    particle.anchorY = 0;
    this.rainLive.push({ particle, vx: data.vx, vy: data.vy });
  }

  private pushSnow(randomY: boolean): void {
    const data = this.spawnSnowParticle(randomY);
    const particle = this.acquireSnow();
    particle.x = data.x;
    particle.y = data.y;
    particle.rotation = Math.random() * Math.PI * 2;
    particle.scaleX = data.scale;
    particle.scaleY = data.scale;
    particle.alpha = data.alpha;
    particle.anchorX = 0.5;
    particle.anchorY = 0.5;
    this.snowLive.push({ particle, vx: data.vx, vy: data.vy, spin: data.spin });
  }

  private spawnRainParticle(randomY = false): {
    x: number;
    y: number;
    vy: number;
    vx: number;
    scale: number;
    alpha: number;
  } {
    const intensity = Math.max(0.35, this.rain);
    return {
      x: Math.random() * DESIGN.width,
      y: randomY ? Math.random() * DESIGN.height : -Math.random() * DESIGN.height * 0.25,
      vy: (650 + Math.random() * 400) * intensity,
      vx: this.wind * 55 + (Math.random() - 0.5) * 18,
      scale: 0.55 + Math.random() * 0.45,
      alpha: 0.35 + Math.random() * 0.2,
    };
  }

  private spawnSnowParticle(randomY = false): {
    x: number;
    y: number;
    vy: number;
    vx: number;
    spin: number;
    scale: number;
    alpha: number;
  } {
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

  private respawnRain(index: number): void {
    const data = this.spawnRainParticle(false);
    const entry = this.rainLive[index]!;
    entry.vx = data.vx;
    entry.vy = data.vy;
    entry.particle.x = data.x;
    entry.particle.y = data.y;
    entry.particle.rotation = rainRotation(data.vx, data.vy);
    entry.particle.scaleX = data.scale;
    entry.particle.scaleY = data.scale;
    entry.particle.alpha = data.alpha;
  }

  private respawnSnow(index: number): void {
    const data = this.spawnSnowParticle(false);
    const entry = this.snowLive[index]!;
    entry.vx = data.vx;
    entry.vy = data.vy;
    entry.spin = data.spin;
    entry.particle.x = data.x;
    entry.particle.y = data.y;
    entry.particle.rotation = Math.random() * Math.PI * 2;
    entry.particle.scaleX = data.scale;
    entry.particle.scaleY = data.scale;
    entry.particle.alpha = data.alpha;
  }

  update(dt: number): void {
    if (this.rain <= 0 && this.snow <= 0) return;

    if (this.rainLive.length > 0) {
      for (let i = 0; i < this.rainLive.length; i++) {
        const p = this.rainLive[i]!;
        p.particle.x += p.vx * dt;
        p.particle.y += p.vy * dt;
        if (
          p.particle.y > DESIGN.height + 30 ||
          p.particle.x < -50 ||
          p.particle.x > DESIGN.width + 50
        ) {
          this.respawnRain(i);
        }
      }
      this.rainContainer.update();
    }

    if (this.snowLive.length > 0) {
      for (let i = 0; i < this.snowLive.length; i++) {
        const p = this.snowLive[i]!;
        p.particle.x += p.vx * dt;
        p.particle.y += p.vy * dt;
        p.particle.rotation += p.spin * dt;
        if (
          p.particle.y > DESIGN.height + 20 ||
          p.particle.x < -50 ||
          p.particle.x > DESIGN.width + 50
        ) {
          this.respawnSnow(i);
        }
      }
      this.snowContainer.update();
    }
  }
}

function rainRotation(vx: number, vy: number): number {
  return Math.atan2(vx, vy);
}
