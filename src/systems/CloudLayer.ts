import { Container, Sprite, type Texture } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { loadTexture } from '../data/AssetLoader';

const CLOUD_TEX_PATH = 'assets/gfx/clouds_background.png';
const SKY_BOTTOM = DESIGN.groundY;

interface DriftingCloud {
  sprite: Sprite;
  vx: number;
}

/** Sky haze + drifting clouds behind and in front of aircraft. */
export class CloudLayer {
  readonly backLayer = new Container();
  readonly frontLayer = new Container();

  private clouds = 0;
  private wind = 0;
  private cloudTex: Texture | null = null;
  private ready = false;
  private backDrifters: DriftingCloud[] = [];
  private frontDrifters: DriftingCloud[] = [];
  private hazeSprites: Sprite[] = [];

  constructor() {
    this.backLayer.eventMode = 'none';
    this.frontLayer.eventMode = 'none';
    void this.loadTexture();
  }

  private async loadTexture(): Promise<void> {
    this.cloudTex = await loadTexture(CLOUD_TEX_PATH);
    if (this.backLayer.destroyed) return;
    this.ready = true;
    if (this.clouds > 0) this.rebuild();
  }

  setWeather(values: number[]): void {
    this.clouds = values[1] ?? 0;
    this.wind = values[3] ?? 0;
    if (!this.ready || this.clouds <= 0) {
      this.clear();
      return;
    }
    this.rebuild();
  }

  private clear(): void {
    this.backLayer.removeChildren();
    this.frontLayer.removeChildren();
    this.backDrifters = [];
    this.frontDrifters = [];
    this.hazeSprites = [];
  }

  private rebuild(): void {
    this.clear();
    if (!this.cloudTex || this.clouds <= 0) return;

    const intensity = Math.min(1, this.clouds / 4);
    const hazeAlpha = Math.min(0.55, 0.08 + this.clouds * 0.12);
    const hazeCount = Math.round(6 + intensity * 10);

    for (let i = 0; i < hazeCount; i++) {
      const sprite = this.makeCloudSprite({
        alpha: hazeAlpha * (0.75 + Math.random() * 0.35),
        scaleMin: 5,
        scaleMax: 12,
        scatterY: true,
      });
      this.hazeSprites.push(sprite);
      this.backLayer.addChild(sprite);
    }

    const backCount = Math.round(Math.min(22, this.clouds * 5));
    for (let i = 0; i < backCount; i++) {
      const drift = this.makeBackDrifter();
      this.backDrifters.push(drift);
      this.backLayer.addChild(drift.sprite);
    }

    const frontCount = Math.round(Math.min(14, Math.max(0, this.clouds - 0.25) * 3.5));
    for (let i = 0; i < frontCount; i++) {
      const drift = this.makeFrontDrifter();
      this.frontDrifters.push(drift);
      this.frontLayer.addChild(drift.sprite);
    }
  }

  private baseDrift(): number {
    return 18 + this.wind * 42;
  }

  /** Gray cloud art lightened to white via screen blend + white tint. */
  private makeCloudSprite(opts: {
    alpha: number;
    scaleMin: number;
    scaleMax: number;
    scatterY: boolean;
    yMin?: number;
    yMax?: number;
  }): Sprite {
    const sprite = new Sprite(this.cloudTex!);
    sprite.anchor.set(0.5);
    const scale = opts.scaleMin + Math.random() * (opts.scaleMax - opts.scaleMin);
    sprite.scale.set(scale);
    sprite.blendMode = 'screen';
    sprite.tint = 0xffffff;
    sprite.alpha = opts.alpha;
    sprite.x = Math.random() * (DESIGN.width + 400) - 200;
    const yMin = opts.yMin ?? 0;
    const yMax = opts.yMax ?? SKY_BOTTOM * 0.9;
    sprite.y = opts.scatterY
      ? yMin + Math.random() * (yMax - yMin)
      : -80 - Math.random() * 120;
    return sprite;
  }

  private makeBackDrifter(): DriftingCloud {
    const sprite = this.makeCloudSprite({
      alpha: Math.min(0.65, 0.2 + this.clouds * 0.07),
      scaleMin: 5,
      scaleMax: 9,
      scatterY: true,
    });
    const drift = this.baseDrift() * (0.55 + Math.random() * 0.35);
    return { sprite, vx: drift * (Math.random() < 0.08 ? -1 : 1) };
  }

  private makeFrontDrifter(): DriftingCloud {
    const sprite = this.makeCloudSprite({
      alpha: Math.min(0.85, 0.35 + this.clouds * 0.1),
      scaleMin: 7,
      scaleMax: 12,
      scatterY: true,
      yMin: 40,
      yMax: SKY_BOTTOM * 0.72,
    });
    const drift = this.baseDrift() * (0.85 + Math.random() * 0.5);
    return { sprite, vx: drift * (Math.random() < 0.12 ? -1 : 1) };
  }

  private wrapCloud(sprite: Sprite, vx: number): void {
    sprite.x += vx;
    const margin = 320;
    if (vx >= 0 && sprite.x > DESIGN.width + margin) {
      sprite.x = -margin;
      sprite.y = 20 + Math.random() * SKY_BOTTOM * 0.85;
    } else if (vx < 0 && sprite.x < -margin) {
      sprite.x = DESIGN.width + margin;
      sprite.y = 20 + Math.random() * SKY_BOTTOM * 0.85;
    }
  }

  update(dt: number): void {
    if (this.clouds <= 0 || !this.ready) return;

    const hazeDrift = this.baseDrift() * 0.25 * dt;
    for (const sprite of this.hazeSprites) {
      sprite.x += hazeDrift;
      if (sprite.x > DESIGN.width + 200) sprite.x -= DESIGN.width + 400;
    }

    for (const drift of this.backDrifters) {
      this.wrapCloud(drift.sprite, drift.vx * dt);
    }
    for (const drift of this.frontDrifters) {
      this.wrapCloud(drift.sprite, drift.vx * dt);
    }
  }
}
