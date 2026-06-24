import { Container, Graphics } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';

interface Particle {
  x: number;
  y: number;
  vy: number;
  vx: number;
  len: number;
}

const MAX_PARTICLES = 220;

export class WeatherLayer extends Container {
  private gfx = new Graphics();
  private particles: Particle[] = [];
  private rain = 0;
  private snow = 0;
  private wind = 0;

  constructor() {
    super();
    this.addChild(this.gfx);
    this.eventMode = 'none';
  }

  setWeather(values: number[]): void {
    this.rain = values[0] ?? 0;
    this.snow = values[2] ?? 0;
    this.wind = values[3] ?? 0;
    this.particles = [];
    const intensity = Math.max(this.rain, this.snow);
    const count = Math.min(MAX_PARTICLES, Math.round(intensity * 120));
    for (let i = 0; i < count; i++) {
      this.particles.push(this.spawnParticle(true));
    }
    if (count === 0) this.gfx.clear();
  }

  private spawnParticle(randomY = false): Particle {
    const snowMode = this.snow > this.rain;
    return {
      x: Math.random() * DESIGN.width,
      y: randomY ? Math.random() * DESIGN.height : -Math.random() * DESIGN.height * 0.2,
      vy: (snowMode ? 35 + Math.random() * 45 : 420 + Math.random() * 280) * Math.max(0.2, snowMode ? this.snow : this.rain),
      vx: this.wind * (snowMode ? 18 : 40) + (Math.random() - 0.5) * 12,
      len: snowMode ? 2 + Math.random() * 3 : 8 + Math.random() * 14,
    };
  }

  update(dt: number): void {
    if (this.rain <= 0 && this.snow <= 0) return;

    const snowMode = this.snow > this.rain;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]!;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > DESIGN.height + 20 || p.x < -40 || p.x > DESIGN.width + 40) {
        this.particles[i] = this.spawnParticle(false);
      }
    }

    this.gfx.clear();
    for (const p of this.particles) {
      if (snowMode) {
        this.gfx.circle(p.x, p.y, p.len).fill({ color: 0xffffff, alpha: 0.75 });
      } else {
        this.gfx.moveTo(p.x, p.y).lineTo(p.x - p.vx * 0.02, p.y - p.len).stroke({
          color: 0xaaccff,
          width: 1.2,
          alpha: 0.55,
        });
      }
    }
  }
}
