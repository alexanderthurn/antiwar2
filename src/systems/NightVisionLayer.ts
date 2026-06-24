import { Container, Graphics } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';

const NIGHT_VISION_RADIUS = 168;

/** Darkness overlay with lit circles at each player crosshair (weather darkness > 0.4). */
export class NightVisionLayer extends Container {
  private base = new Graphics();
  private holes = new Graphics();

  constructor() {
    super();
    this.eventMode = 'none';
    this.holes.blendMode = 'erase';
    this.addChild(this.base, this.holes);
    this.visible = false;
  }

  update(darkness: number, aimPoints: { x: number; y: number }[]): void {
    if (darkness <= 0.4 || aimPoints.length === 0) {
      this.visible = false;
      return;
    }

    this.visible = true;
    const alpha = Math.min(0.9, 0.45 + (darkness - 0.4) * 0.9);

    this.base.clear();
    this.base.rect(0, 0, DESIGN.width, DESIGN.height).fill({ color: 0x020208, alpha });

    this.holes.clear();
    for (const { x, y } of aimPoints) {
      this.holes.circle(x, y, NIGHT_VISION_RADIUS).fill({ color: 0xffffff, alpha: 1 });
    }
  }
}
